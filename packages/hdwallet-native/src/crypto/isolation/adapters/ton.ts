import * as core from "@shapeshiftoss/hdwallet-core";
import { createSHA256 } from "hash-wasm";

import { Isolation } from "../..";

const ED25519_PUBLIC_KEY_SIZE = 32;
const WALLET_V4R2_SUBWALLET_ID = 698983191;

const WALLET_V4R2_CODE_HASH_HEX = "feb5ff6820e2ff0d9483e7e0d62c817d846789fb4ae580c878866d959dabd5c0";

class BitBuilder {
  private bits: number[] = [];

  writeBit(bit: number): void {
    this.bits.push(bit ? 1 : 0);
  }

  writeUint(value: number | bigint, bitCount: number): void {
    const bigValue = BigInt(value);
    for (let i = bitCount - 1; i >= 0; i--) {
      this.writeBit(Number((bigValue >> BigInt(i)) & BigInt(1)));
    }
  }

  writeBytes(bytes: Uint8Array): void {
    for (const byte of bytes) {
      this.writeUint(byte, 8);
    }
  }

  // Write variable-length integer (used for coins/amounts)
  writeCoins(amount: bigint): void {
    if (amount === BigInt(0)) {
      this.writeUint(0, 4); // 4 bits for length = 0
      return;
    }

    // Calculate byte length needed
    let temp = amount;
    let byteLen = 0;
    while (temp > 0) {
      byteLen++;
      temp >>= BigInt(8);
    }

    this.writeUint(byteLen, 4); // 4 bits for length

    // Write bytes in big-endian
    const bytes = new Uint8Array(byteLen);
    temp = amount;
    for (let i = byteLen - 1; i >= 0; i--) {
      bytes[i] = Number(temp & BigInt(0xff));
      temp >>= BigInt(8);
    }
    this.writeBytes(bytes);
  }

  // Write TON address (MsgAddressInt format)
  writeAddress(workchain: number, hash: Uint8Array): void {
    // addr_std$10 anycast:(Maybe Anycast) workchain_id:int8 address:bits256
    this.writeBit(1); // addr_std tag bit 1
    this.writeBit(0); // addr_std tag bit 0
    this.writeBit(0); // no anycast (Maybe bit = 0)
    this.writeUint(workchain & 0xff, 8); // workchain as int8
    this.writeBytes(hash); // 256-bit address
  }

  getBitLength(): number {
    return this.bits.length;
  }

  getBits(): number[] {
    return [...this.bits];
  }
}

class Cell {
  readonly bits: number[];
  readonly refs: Cell[];

  constructor(bits: number[] = [], refs: Cell[] = []) {
    this.bits = bits;
    this.refs = refs;
  }

  getDepth(): number {
    if (this.refs.length === 0) return 0;
    let maxDepth = 0;
    for (const ref of this.refs) {
      const d = ref.getDepth();
      if (d > maxDepth) maxDepth = d;
    }
    return maxDepth + 1;
  }

  async getRepr(): Promise<Uint8Array> {
    const bitLen = this.bits.length;
    const byteLen = Math.ceil(bitLen / 8);
    const refsCount = this.refs.length;

    // d1: refs_descriptor = refs_count + is_exotic*8 + level_mask*32
    const d1 = refsCount;
    // d2: bits_descriptor = floor(bit_length/8) + ceil(bit_length/8)
    const d2 = Math.ceil(bitLen / 8) + Math.floor(bitLen / 8);

    const dataBytes = new Uint8Array(byteLen);
    for (let i = 0; i < bitLen; i++) {
      if (this.bits[i]) {
        dataBytes[Math.floor(i / 8)] |= 1 << (7 - (i % 8));
      }
    }
    // Add completion tag if not byte-aligned
    if (bitLen % 8 !== 0 && byteLen > 0) {
      const usedBits = bitLen % 8;
      dataBytes[byteLen - 1] |= 1 << (7 - usedBits);
    }

    const refDepths: number[] = [];
    const refHashes: Uint8Array[] = [];
    for (const ref of this.refs) {
      refDepths.push(ref.getDepth());
      refHashes.push(await ref.hash());
    }

    const totalLen = 2 + byteLen + refsCount * 2 + refsCount * 32;
    const repr = new Uint8Array(totalLen);
    repr[0] = d1;
    repr[1] = d2;
    repr.set(dataBytes, 2);

    let offset = 2 + byteLen;
    for (const depth of refDepths) {
      repr[offset] = Math.floor(depth / 256);
      repr[offset + 1] = depth % 256;
      offset += 2;
    }
    for (const h of refHashes) {
      repr.set(h, offset);
      offset += 32;
    }

    return repr;
  }

  async hash(): Promise<Uint8Array> {
    const repr = await this.getRepr();
    const sha256 = await createSHA256();
    sha256.init();
    sha256.update(repr);
    return sha256.digest("binary");
  }

  // Serialize cell to bytes for BOC
  async serialize(): Promise<Uint8Array> {
    const bitLen = this.bits.length;
    const byteLen = Math.ceil(bitLen / 8);
    const refsCount = this.refs.length;

    // d1 and d2 descriptors
    const d1 = refsCount;
    const d2 = Math.ceil(bitLen / 8) + Math.floor(bitLen / 8);

    const dataBytes = new Uint8Array(byteLen);
    for (let i = 0; i < bitLen; i++) {
      if (this.bits[i]) {
        dataBytes[Math.floor(i / 8)] |= 1 << (7 - (i % 8));
      }
    }
    // Add completion tag if not byte-aligned
    if (bitLen % 8 !== 0 && byteLen > 0) {
      const usedBits = bitLen % 8;
      dataBytes[byteLen - 1] |= 1 << (7 - usedBits);
    }

    // For BOC serialization, just return d1, d2 + data
    const result = new Uint8Array(2 + byteLen);
    result[0] = d1;
    result[1] = d2;
    result.set(dataBytes, 2);
    return result;
  }
}

class CodeCell extends Cell {
  private knownHash: Uint8Array;
  private knownDepth: number;

  constructor(hash: Uint8Array, depth: number) {
    super();
    this.knownHash = hash;
    this.knownDepth = depth;
  }

  getDepth(): number {
    return this.knownDepth;
  }

  async hash(): Promise<Uint8Array> {
    return this.knownHash;
  }
}

// CRC32C implementation for BOC
function crc32c(data: Uint8Array): number {
  const CRC32C_TABLE: number[] = [];
  for (let i = 0; i < 256; i++) {
    let crc = i;
    for (let j = 0; j < 8; j++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0x82f63b78 : crc >>> 1;
    }
    CRC32C_TABLE[i] = crc >>> 0;
  }

  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = CRC32C_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// Serialize a cell tree to BOC format
async function serializeToBoc(root: Cell): Promise<Uint8Array> {
  // Collect all cells in topological order
  const cells: Cell[] = [];
  const cellHashes = new Map<string, number>();

  async function collectCells(cell: Cell): Promise<void> {
    const hashHex = Array.from(await cell.hash())
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    if (cellHashes.has(hashHex)) return;

    // Process refs first (children before parents)
    for (const ref of cell.refs) {
      await collectCells(ref);
    }

    cellHashes.set(hashHex, cells.length);
    cells.push(cell);
  }

  await collectCells(root);

  // Reverse to have root first
  cells.reverse();
  const newHashMap = new Map<string, number>();
  for (let i = 0; i < cells.length; i++) {
    const hashHex = Array.from(await cells[i].hash())
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    newHashMap.set(hashHex, i);
  }

  // Build cell data
  const cellDatas: Uint8Array[] = [];
  for (const cell of cells) {
    const bitLen = cell.bits.length;
    const byteLen = Math.ceil(bitLen / 8);

    // d1: refs_count (lower 3 bits)
    const d1 = cell.refs.length;
    // d2: ceil(bitLen/8) + floor(bitLen/8)
    const d2 = Math.ceil(bitLen / 8) + Math.floor(bitLen / 8);

    const dataBytes = new Uint8Array(byteLen);
    for (let i = 0; i < bitLen; i++) {
      if (cell.bits[i]) {
        dataBytes[Math.floor(i / 8)] |= 1 << (7 - (i % 8));
      }
    }
    // Add completion tag if not byte-aligned
    if (bitLen % 8 !== 0 && byteLen > 0) {
      const usedBits = bitLen % 8;
      dataBytes[byteLen - 1] |= 1 << (7 - usedBits);
    }

    // Build ref indices
    const refIndices: number[] = [];
    for (const ref of cell.refs) {
      const refHashHex = Array.from(await ref.hash())
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      const refIdx = newHashMap.get(refHashHex);
      if (refIdx === undefined) throw new Error("Reference not found");
      refIndices.push(refIdx);
    }

    // Cell data: d1, d2, data bytes, ref indices (1 byte each for small BOCs)
    const cellData = new Uint8Array(2 + byteLen + refIndices.length);
    cellData[0] = d1;
    cellData[1] = d2;
    cellData.set(dataBytes, 2);
    for (let i = 0; i < refIndices.length; i++) {
      cellData[2 + byteLen + i] = refIndices[i];
    }

    cellDatas.push(cellData);
  }

  // Calculate total data size
  let totalDataSize = 0;
  for (const data of cellDatas) {
    totalDataSize += data.length;
  }

  // BOC header
  // Magic: B5EE9C72 (4 bytes)
  // Flags: has_idx:1 has_crc32c:1 has_cache_bits:1 flags:2 size:(##3) = 1 byte
  // off_bytes: size of offset integers
  // cells:(##(size * 8))
  // roots:(##(size * 8))
  // absent:(##(size * 8))
  // tot_cells_size:(##(off_bytes * 8))
  // root_list:(roots * ##(size * 8))
  // index:cells * ##(off_bytes * 8) [if has_idx]
  // cell_data
  // crc32c [if has_crc32c]

  const cellCount = cells.length;
  const rootCount = 1;
  const absentCount = 0;

  // Determine size byte count (how many bytes for cell indices)
  const sizeBytes = cellCount <= 255 ? 1 : 2;

  // Determine offset byte count
  const offBytes = totalDataSize <= 255 ? 1 : totalDataSize <= 65535 ? 2 : 4;

  // Calculate header size
  const headerSize =
    4 + // magic
    1 + // flags byte
    1 + // off_bytes
    sizeBytes + // cells count
    sizeBytes + // roots count
    sizeBytes + // absent count
    offBytes + // total cells size
    rootCount * sizeBytes; // root list

  // No index for now (has_idx = 0)
  const bocSize = headerSize + totalDataSize + 4; // +4 for CRC32C

  const boc = new Uint8Array(bocSize);
  let offset = 0;

  // Magic: B5EE9C72
  boc[offset++] = 0xb5;
  boc[offset++] = 0xee;
  boc[offset++] = 0x9c;
  boc[offset++] = 0x72;

  // Flags byte: has_idx=0, has_crc32c=1, has_cache_bits=0, flags=0, size=sizeBytes-1
  const flagsByte = (0 << 7) | (1 << 6) | (0 << 5) | ((sizeBytes - 1) & 0x07);
  boc[offset++] = flagsByte;

  // off_bytes
  boc[offset++] = offBytes;

  // cells count
  if (sizeBytes === 1) {
    boc[offset++] = cellCount;
  } else {
    boc[offset++] = (cellCount >> 8) & 0xff;
    boc[offset++] = cellCount & 0xff;
  }

  // roots count
  if (sizeBytes === 1) {
    boc[offset++] = rootCount;
  } else {
    boc[offset++] = (rootCount >> 8) & 0xff;
    boc[offset++] = rootCount & 0xff;
  }

  // absent count
  if (sizeBytes === 1) {
    boc[offset++] = absentCount;
  } else {
    boc[offset++] = (absentCount >> 8) & 0xff;
    boc[offset++] = absentCount & 0xff;
  }

  // total cells size
  if (offBytes === 1) {
    boc[offset++] = totalDataSize;
  } else if (offBytes === 2) {
    boc[offset++] = (totalDataSize >> 8) & 0xff;
    boc[offset++] = totalDataSize & 0xff;
  } else {
    boc[offset++] = (totalDataSize >> 24) & 0xff;
    boc[offset++] = (totalDataSize >> 16) & 0xff;
    boc[offset++] = (totalDataSize >> 8) & 0xff;
    boc[offset++] = totalDataSize & 0xff;
  }

  // root list (just root index 0)
  if (sizeBytes === 1) {
    boc[offset++] = 0;
  } else {
    boc[offset++] = 0;
    boc[offset++] = 0;
  }

  // Cell data
  for (const cellData of cellDatas) {
    boc.set(cellData, offset);
    offset += cellData.length;
  }

  // CRC32C checksum
  const crc = crc32c(boc.slice(0, offset));
  boc[offset++] = crc & 0xff;
  boc[offset++] = (crc >> 8) & 0xff;
  boc[offset++] = (crc >> 16) & 0xff;
  boc[offset++] = (crc >> 24) & 0xff;

  return boc;
}

export interface TonTransactionParams {
  from: string; // sender address (user-friendly)
  to: string; // recipient address (user-friendly)
  value: string; // amount in nanotons as string
  seqno: number;
  expireAt: number;
  memo?: string;
  contractAddress?: string; // for jetton transfers
}

export class TonAdapter {
  protected readonly nodeAdapter: Isolation.Adapters.Ed25519;

  constructor(nodeAdapter: Isolation.Adapters.Ed25519) {
    this.nodeAdapter = nodeAdapter;
  }

  async getAddress(addressNList: core.BIP32Path): Promise<string> {
    const nodeAdapter = await this.nodeAdapter.derivePath(core.addressNListToHardenedBIP32(addressNList));
    const publicKey = await nodeAdapter.getPublicKey();

    if (publicKey.length !== ED25519_PUBLIC_KEY_SIZE) {
      throw new Error(`Invalid Ed25519 public key size: ${publicKey.length}`);
    }

    const stateInitHash = await this.computeWalletV4R2Address(publicKey);
    return this.formatUserFriendlyAddress(0, stateInitHash, false, false);
  }

  // Parse user-friendly address to workchain and hash
  private parseAddress(address: string): { workchain: number; hash: Uint8Array } {
    // Handle raw format: workchain:hex
    const rawMatch = address.match(/^(-?\d+):([0-9a-fA-F]{64})$/);
    if (rawMatch) {
      const workchain = parseInt(rawMatch[1], 10);
      const hash = this.hexToBytes(rawMatch[2]);
      return { workchain, hash };
    }

    // Handle user-friendly format (base64url encoded)
    const base64 = address.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

    if (decoded.length !== 36) {
      throw new Error(`Invalid address length: ${decoded.length}`);
    }

    const tag = decoded[0];
    let workchain = decoded[1];
    // Handle signed workchain
    if (workchain > 127) workchain = workchain - 256;

    const hash = decoded.slice(2, 34);

    return { workchain, hash };
  }

  async signTransaction(message: Uint8Array, addressNList: core.BIP32Path): Promise<string> {
    const nodeAdapter = await this.nodeAdapter.derivePath(core.addressNListToHardenedBIP32(addressNList));
    const signature = await nodeAdapter.node.sign(message);
    return Array.from(signature)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  // Create and sign a complete TON transfer transaction, returning BOC
  async createSignedTransferBoc(params: TonTransactionParams, addressNList: core.BIP32Path): Promise<string> {
    const nodeAdapter = await this.nodeAdapter.derivePath(core.addressNListToHardenedBIP32(addressNList));
    const publicKey = await nodeAdapter.getPublicKey();

    // Parse destination address
    const destAddr = this.parseAddress(params.to);

    // 1. Build internal message (the actual transfer)
    const internalMsgBits = new BitBuilder();

    // int_msg_info$0 ihr_disabled:Bool bounce:Bool bounced:Bool
    // src:MsgAddressInt dest:MsgAddressInt
    // value:CurrencyCollection ihr_fee:Grams fwd_fee:Grams
    // created_lt:uint64 created_at:uint32

    // Use flags: 0x10 = ihr_disabled=0, bounce=1, bounced=0
    // For non-bounceable: 0x18 = ihr_disabled=0, bounce=0, bounced=0, extra bits
    internalMsgBits.writeUint(0, 1); // int_msg_info tag = 0
    internalMsgBits.writeBit(1); // ihr_disabled = true
    internalMsgBits.writeBit(destAddr.workchain >= 0 ? 1 : 0); // bounce (true for standard)
    internalMsgBits.writeBit(0); // bounced = false

    // src: addr_none$00 (will be filled by contract)
    internalMsgBits.writeBit(0);
    internalMsgBits.writeBit(0);

    // dest: addr_std$10 anycast:(Maybe Anycast) workchain_id:int8 address:bits256
    internalMsgBits.writeAddress(destAddr.workchain, destAddr.hash);

    // value: Grams as VarUInteger16
    internalMsgBits.writeCoins(BigInt(params.value));

    // extra_currencies: empty dict (1 bit = 0)
    internalMsgBits.writeBit(0);

    // ihr_fee, fwd_fee: 0
    internalMsgBits.writeCoins(BigInt(0)); // ihr_fee
    internalMsgBits.writeCoins(BigInt(0)); // fwd_fee

    // created_lt and created_at (will be filled by validators): 0
    internalMsgBits.writeUint(0, 64); // created_lt
    internalMsgBits.writeUint(0, 32); // created_at

    // init: Maybe (Either StateInit ^StateInit) = nothing
    internalMsgBits.writeBit(0);

    // body: Either X ^X
    if (params.memo) {
      // Store body as reference
      internalMsgBits.writeBit(1); // body is reference

      // Create comment body cell
      const bodyBits = new BitBuilder();
      bodyBits.writeUint(0, 32); // op = 0 for text comment
      const memoBytes = new TextEncoder().encode(params.memo);
      bodyBits.writeBytes(memoBytes);

      const bodyCell = new Cell(bodyBits.getBits());
      const internalMsgCell = new Cell(internalMsgBits.getBits(), [bodyCell]);

      return this.createExternalMessage(internalMsgCell, params, publicKey, nodeAdapter);
    } else {
      // body inline (empty or just a bit)
      internalMsgBits.writeBit(0); // body inline
      // Empty body

      const internalMsgCell = new Cell(internalMsgBits.getBits());
      return this.createExternalMessage(internalMsgCell, params, publicKey, nodeAdapter);
    }
  }

  private async createExternalMessage(
    internalMsgCell: Cell,
    params: TonTransactionParams,
    publicKey: Uint8Array,
    nodeAdapter: Isolation.Adapters.Ed25519
  ): Promise<string> {
    // 2. Build wallet v4r2 signing message
    const signingBits = new BitBuilder();
    signingBits.writeUint(WALLET_V4R2_SUBWALLET_ID, 32); // subwallet_id
    signingBits.writeUint(params.expireAt, 32); // valid_until
    signingBits.writeUint(params.seqno, 32); // seqno
    signingBits.writeUint(0, 8); // op = 0 for simple send (wallet v4)
    signingBits.writeUint(3, 8); // send_mode = 3 (pay fees separately, ignore errors)

    const signingCell = new Cell(signingBits.getBits(), [internalMsgCell]);

    // 3. Sign the message hash
    const messageHash = await signingCell.hash();
    const signature = await nodeAdapter.node.sign(messageHash);

    // 4. Build signed body: signature + signed message
    const bodyBits = new BitBuilder();
    bodyBits.writeBytes(signature); // 512 bits (64 bytes)

    // Copy signing cell bits
    for (const bit of signingCell.bits) {
      bodyBits.writeBit(bit);
    }

    const signedBodyCell = new Cell(bodyBits.getBits(), signingCell.refs);

    // 5. Build external message
    const senderAddr = this.parseAddress(params.from);

    const extMsgBits = new BitBuilder();
    // ext_in_msg_info$10 src:MsgAddressExt dest:MsgAddressInt import_fee:Grams
    extMsgBits.writeBit(1); // ext_in_msg_info tag bit 1
    extMsgBits.writeBit(0); // ext_in_msg_info tag bit 0

    // src: addr_none$00
    extMsgBits.writeBit(0);
    extMsgBits.writeBit(0);

    // dest: wallet address
    extMsgBits.writeAddress(senderAddr.workchain, senderAddr.hash);

    // import_fee: 0
    extMsgBits.writeCoins(BigInt(0));

    // init: Maybe (Either StateInit ^StateInit)
    // For established wallets, no state init needed
    extMsgBits.writeBit(0); // no state init

    // body: Either X ^X - store as reference
    extMsgBits.writeBit(1); // body is reference

    const externalMsgCell = new Cell(extMsgBits.getBits(), [signedBodyCell]);

    // 6. Serialize to BOC
    const boc = await serializeToBoc(externalMsgCell);

    // Return as base64
    let binary = "";
    for (let i = 0; i < boc.length; i++) {
      binary += String.fromCharCode(boc[i]);
    }
    return btoa(binary);
  }

  async getPublicKey(addressNList: core.BIP32Path): Promise<string> {
    const nodeAdapter = await this.nodeAdapter.derivePath(core.addressNListToHardenedBIP32(addressNList));
    const publicKey = await nodeAdapter.getPublicKey();
    return Array.from(publicKey)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  private async computeWalletV4R2Address(publicKey: Uint8Array): Promise<Uint8Array> {
    const dataCell = this.buildDataCell(publicKey);
    const codeCell = new CodeCell(this.hexToBytes(WALLET_V4R2_CODE_HASH_HEX), 7);

    const stateInitBits = new BitBuilder();
    stateInitBits.writeBit(0);
    stateInitBits.writeBit(0);
    stateInitBits.writeBit(1);
    stateInitBits.writeBit(1);
    stateInitBits.writeBit(0);

    const stateInitCell = new Cell(stateInitBits.getBits(), [codeCell, dataCell]);
    return stateInitCell.hash();
  }

  private buildDataCell(publicKey: Uint8Array): Cell {
    const bits = new BitBuilder();
    bits.writeUint(0, 32);
    bits.writeUint(WALLET_V4R2_SUBWALLET_ID, 32);
    bits.writeBytes(publicKey);
    bits.writeBit(0);
    return new Cell(bits.getBits());
  }

  private formatUserFriendlyAddress(
    workchain: number,
    hash: Uint8Array,
    isBounceable: boolean,
    isTestnet: boolean
  ): string {
    let tag = isBounceable ? 0x11 : 0x51;
    if (isTestnet) tag |= 0x80;

    const addr = new Uint8Array(36);
    addr[0] = tag;
    addr[1] = workchain & 0xff;
    addr.set(hash, 2);

    const checksum = this.crc16(addr.slice(0, 34));
    addr[34] = (checksum >> 8) & 0xff;
    addr[35] = checksum & 0xff;

    return this.base64UrlEncode(addr);
  }

  private crc16(data: Uint8Array): number {
    const POLY = 0x1021;
    let crc = 0;
    for (let i = 0; i < data.length; i++) {
      crc ^= data[i] << 8;
      for (let j = 0; j < 8; j++) {
        crc = crc & 0x8000 ? ((crc << 1) ^ POLY) & 0xffff : (crc << 1) & 0xffff;
      }
    }
    return crc;
  }

  private base64UrlEncode(data: Uint8Array): string {
    let binary = "";
    for (let i = 0; i < data.length; i++) {
      binary += String.fromCharCode(data[i]);
    }
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_");
  }

  private hexToBytes(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes;
  }
}

export default TonAdapter;
