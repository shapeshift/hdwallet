import * as core from "@shapeshiftoss/hdwallet-core";
import { createSHA256 } from "hash-wasm";

import { Isolation } from "../..";

const ED25519_PUBLIC_KEY_SIZE = 32;
const WALLET_V4R2_SUBWALLET_ID = 698983191;

const WALLET_V4R2_CODE_HASH_HEX = "feb5ff6820e2ff0d9483e7e0d62c817d846789fb4ae580c878866d959dabd5c0";

const WALLET_V4R2_CODE_BOC_HEX =
  "b5ee9c72410214010002d4000114ff00f4a413f4bcf2c80b01020120020f020148030602e6d001d0d3032171b0925f04e022d749c120925f04e002d31f218210706c7567bd22821064737472bdb0925f05e003fa403020fa4401c8ca07cbffc9d0ed44d0810140d721f404305c810108f40a6fa131b3925f07e005d33fc8258210706c7567ba923830e30d03821064737472ba925f06e30d0405007801fa00f40430f8276f2230500aa121bef2e0508210706c7567831eb17080185004cb0526cf1658fa0219f400cb6917cb1f5260cb3f20c98040fb0006008a5004810108f45930ed44d0810140d720c801cf16f400c9ed540172b08e23821064737472831eb17080185005cb055003cf1623fa0213cb6acb1fcb3fc98040fb00925f03e2020120070e020120080d020158090a003db29dfb513420405035c87d010c00b23281f2fff274006040423d029be84c600201200b0c0019adce76a26840206b90eb85ffc00019af1df6a26840106b90eb858fc00011b8c97ed44d0d70b1f80059bd242b6f6a2684080a06b90fa0218470d4080847a4937d29910ce6903e9ff9837812801b7810148987159f318404f8f28308d71820d31fd31fd31f02f823bbf264ed44d0d31fd31fd3fff404d15143baf2a15151baf2a205f901541064f910f2a3f80024a4c8cb1f5240cb1f5230cbff5210f400c9ed54f80f01d30721c0009f6c519320d74a96d307d402fb00e830e021c001e30021c002e30001c0039130e30d03a4c8cb1f12cb1fcbff10111213006ed207fa00d4d422f90005c8ca0715cbffc9d077748018c8cb05cb0222cf165005fa0214cb6b12ccccc973fb00c84014810108f451f2a7020070810108d718fa00d33fc8542047810108f451f2a782106e6f746570748018c8cb05cb025006cf165004fa0214cb6a12cb1fcb3fc973fb0002006c810108d718fa00d33f305224810108f459f2a782106473747270748018c8cb05cb025005cf165003fa0213cb6acb1f12cb3fc973fb00000af400c9ed5408f8e528";

const JETTON_TRANSFER_OP = 0x0f8a7ea5;
const JETTON_FORWARD_AMOUNT = BigInt(1);

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

async function serializeToBoc(root: Cell): Promise<Uint8Array> {
  const cells: Cell[] = [];
  const cellHashes = new Map<string, number>();

  async function collectCells(cell: Cell): Promise<void> {
    const hashHex = Array.from(await cell.hash())
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    if (cellHashes.has(hashHex)) return;

    for (const ref of cell.refs) {
      await collectCells(ref);
    }

    cellHashes.set(hashHex, cells.length);
    cells.push(cell);
  }

  await collectCells(root);

  cells.reverse();
  const newHashMap = new Map<string, number>();
  for (let i = 0; i < cells.length; i++) {
    const hashHex = Array.from(await cells[i].hash())
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    newHashMap.set(hashHex, i);
  }

  const cellCount = cells.length;
  const rootCount = 1;
  const absentCount = 0;

  const bitsForCellCount = cellCount > 0 ? Math.ceil(Math.log2(cellCount + 1)) : 1;
  const sizeBytes = Math.max(Math.ceil(bitsForCellCount / 8), 1);

  const cellDatas: Uint8Array[] = [];
  for (const cell of cells) {
    const bitLen = cell.bits.length;
    const byteLen = Math.ceil(bitLen / 8);

    const d1 = cell.refs.length;
    const d2 = Math.ceil(bitLen / 8) + Math.floor(bitLen / 8);

    const dataBytes = new Uint8Array(byteLen);
    for (let i = 0; i < bitLen; i++) {
      if (cell.bits[i]) {
        dataBytes[Math.floor(i / 8)] |= 1 << (7 - (i % 8));
      }
    }
    if (bitLen % 8 !== 0 && byteLen > 0) {
      const usedBits = bitLen % 8;
      dataBytes[byteLen - 1] |= 1 << (7 - usedBits);
    }

    const refIndices: number[] = [];
    for (const ref of cell.refs) {
      const refHashHex = Array.from(await ref.hash())
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      const refIdx = newHashMap.get(refHashHex);
      if (refIdx === undefined) throw new Error("Reference not found");
      refIndices.push(refIdx);
    }

    const cellData = new Uint8Array(2 + byteLen + refIndices.length * sizeBytes);
    cellData[0] = d1;
    cellData[1] = d2;
    cellData.set(dataBytes, 2);
    for (let i = 0; i < refIndices.length; i++) {
      for (let j = sizeBytes - 1; j >= 0; j--) {
        cellData[2 + byteLen + i * sizeBytes + (sizeBytes - 1 - j)] = (refIndices[i] >> (j * 8)) & 0xff;
      }
    }

    cellDatas.push(cellData);
  }

  let totalDataSize = 0;
  for (const data of cellDatas) {
    totalDataSize += data.length;
  }

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

  // Flags byte: has_idx=0, has_crc32c=1, has_cache_bits=0, flags=0, size=sizeBytes (NOT sizeBytes-1)
  // ton-core writes sizeBytes directly into the 3-bit field
  const flagsByte = (0 << 7) | (1 << 6) | (0 << 5) | (sizeBytes & 0x07);
  boc[offset++] = flagsByte;

  boc[offset++] = offBytes;

  const writeSize = (value: number, bytes: number) => {
    for (let i = bytes - 1; i >= 0; i--) {
      boc[offset++] = (value >> (i * 8)) & 0xff;
    }
  };

  writeSize(cellCount, sizeBytes);
  writeSize(rootCount, sizeBytes);
  writeSize(absentCount, sizeBytes);
  writeSize(totalDataSize, offBytes);
  writeSize(0, sizeBytes);

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
  contractAddress?: string; // for jetton transfers (jetton wallet address)
  type?: "transfer" | "jetton_transfer";
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

  async createSignedTransferBoc(params: TonTransactionParams, addressNList: core.BIP32Path): Promise<string> {
    const nodeAdapter = await this.nodeAdapter.derivePath(core.addressNListToHardenedBIP32(addressNList));
    const publicKey = await nodeAdapter.getPublicKey();

    const isJettonTransfer = params.type === "jetton_transfer" || !!params.contractAddress;

    let internalMsgCell: Cell;

    if (isJettonTransfer && params.contractAddress) {
      internalMsgCell = this.buildJettonTransferMessage(params);
    } else {
      internalMsgCell = this.buildTonTransferMessage(params);
    }

    const needsStateInit = params.seqno === 0;

    return this.createExternalMessage(internalMsgCell, params, publicKey, nodeAdapter, needsStateInit);
  }

  private buildTonTransferMessage(params: TonTransactionParams): Cell {
    const destAddr = this.parseAddress(params.to);
    const internalMsgBits = new BitBuilder();

    internalMsgBits.writeUint(0, 1);
    internalMsgBits.writeBit(1);
    internalMsgBits.writeBit(destAddr.workchain >= 0 ? 1 : 0);
    internalMsgBits.writeBit(0);

    internalMsgBits.writeBit(0);
    internalMsgBits.writeBit(0);

    internalMsgBits.writeAddress(destAddr.workchain, destAddr.hash);
    internalMsgBits.writeCoins(BigInt(params.value));
    internalMsgBits.writeBit(0);
    internalMsgBits.writeCoins(BigInt(0));
    internalMsgBits.writeCoins(BigInt(0));
    internalMsgBits.writeUint(0, 64);
    internalMsgBits.writeUint(0, 32);
    internalMsgBits.writeBit(0);

    if (params.memo) {
      internalMsgBits.writeBit(1);

      const bodyBits = new BitBuilder();
      bodyBits.writeUint(0, 32);
      const memoBytes = new TextEncoder().encode(params.memo);
      bodyBits.writeBytes(memoBytes);

      const bodyCell = new Cell(bodyBits.getBits());
      return new Cell(internalMsgBits.getBits(), [bodyCell]);
    } else {
      internalMsgBits.writeBit(0);
      return new Cell(internalMsgBits.getBits());
    }
  }

  private buildJettonTransferMessage(params: TonTransactionParams): Cell {
    const jettonWalletAddr = this.parseAddress(params.contractAddress!);
    const destAddr = this.parseAddress(params.to);
    const senderAddr = this.parseAddress(params.from);

    const jettonBodyBits = new BitBuilder();
    jettonBodyBits.writeUint(JETTON_TRANSFER_OP, 32);
    jettonBodyBits.writeUint(0, 64);
    jettonBodyBits.writeCoins(BigInt(params.value));
    jettonBodyBits.writeAddress(destAddr.workchain, destAddr.hash);
    jettonBodyBits.writeAddress(senderAddr.workchain, senderAddr.hash);
    jettonBodyBits.writeBit(0);
    jettonBodyBits.writeCoins(JETTON_FORWARD_AMOUNT);

    if (params.memo) {
      jettonBodyBits.writeBit(1);
      const commentBits = new BitBuilder();
      commentBits.writeUint(0, 32);
      const memoBytes = new TextEncoder().encode(params.memo);
      commentBits.writeBytes(memoBytes);
      const commentCell = new Cell(commentBits.getBits());
      const jettonBodyCell = new Cell(jettonBodyBits.getBits(), [commentCell]);
      return this.buildInternalMessageToJettonWallet(jettonWalletAddr, jettonBodyCell);
    } else {
      jettonBodyBits.writeBit(0);
      const jettonBodyCell = new Cell(jettonBodyBits.getBits());
      return this.buildInternalMessageToJettonWallet(jettonWalletAddr, jettonBodyCell);
    }
  }

  private buildInternalMessageToJettonWallet(
    jettonWalletAddr: { workchain: number; hash: Uint8Array },
    jettonBodyCell: Cell
  ): Cell {
    const JETTON_TRANSFER_GAS = BigInt(100000000);

    const internalMsgBits = new BitBuilder();
    internalMsgBits.writeUint(0, 1);
    internalMsgBits.writeBit(1);
    internalMsgBits.writeBit(1);
    internalMsgBits.writeBit(0);

    internalMsgBits.writeBit(0);
    internalMsgBits.writeBit(0);

    internalMsgBits.writeAddress(jettonWalletAddr.workchain, jettonWalletAddr.hash);
    internalMsgBits.writeCoins(JETTON_TRANSFER_GAS);
    internalMsgBits.writeBit(0);
    internalMsgBits.writeCoins(BigInt(0));
    internalMsgBits.writeCoins(BigInt(0));
    internalMsgBits.writeUint(0, 64);
    internalMsgBits.writeUint(0, 32);
    internalMsgBits.writeBit(0);
    internalMsgBits.writeBit(1);

    return new Cell(internalMsgBits.getBits(), [jettonBodyCell]);
  }

  private async createExternalMessage(
    internalMsgCell: Cell,
    params: TonTransactionParams,
    publicKey: Uint8Array,
    nodeAdapter: Isolation.Adapters.Ed25519,
    needsStateInit: boolean = false
  ): Promise<string> {
    const signingBits = new BitBuilder();
    signingBits.writeUint(WALLET_V4R2_SUBWALLET_ID, 32);
    signingBits.writeUint(params.expireAt, 32);
    signingBits.writeUint(params.seqno, 32);
    signingBits.writeUint(0, 8);
    signingBits.writeUint(3, 8);

    const signingCell = new Cell(signingBits.getBits(), [internalMsgCell]);

    const messageHash = await signingCell.hash();
    const signature = await nodeAdapter.node.sign(messageHash);

    const bodyBits = new BitBuilder();
    bodyBits.writeBytes(signature);

    for (const bit of signingCell.bits) {
      bodyBits.writeBit(bit);
    }

    const signedBodyCell = new Cell(bodyBits.getBits(), signingCell.refs);

    const senderAddr = this.parseAddress(params.from);

    const extMsgBits = new BitBuilder();
    extMsgBits.writeBit(1);
    extMsgBits.writeBit(0);

    extMsgBits.writeBit(0);
    extMsgBits.writeBit(0);

    extMsgBits.writeAddress(senderAddr.workchain, senderAddr.hash);

    extMsgBits.writeCoins(BigInt(0));

    if (needsStateInit) {
      extMsgBits.writeBit(1);
      extMsgBits.writeBit(1);
      const stateInitCell = await this.buildStateInitCell(publicKey);
      extMsgBits.writeBit(1);
      const externalMsgCell = new Cell(extMsgBits.getBits(), [stateInitCell, signedBodyCell]);
      const boc = await serializeToBoc(externalMsgCell);
      return this.bocToBase64(boc);
    } else {
      extMsgBits.writeBit(0);
      extMsgBits.writeBit(1);
      const externalMsgCell = new Cell(extMsgBits.getBits(), [signedBodyCell]);
      const boc = await serializeToBoc(externalMsgCell);
      return this.bocToBase64(boc);
    }
  }

  private bocToBase64(boc: Uint8Array): string {
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

  private async buildStateInitCell(publicKey: Uint8Array): Promise<Cell> {
    const dataCell = this.buildDataCell(publicKey);
    const codeCell = await this.deserializeBocToCell(this.hexToBytes(WALLET_V4R2_CODE_BOC_HEX));

    const stateInitBits = new BitBuilder();
    stateInitBits.writeBit(0); // split_depth: Nothing
    stateInitBits.writeBit(0); // special: Nothing
    stateInitBits.writeBit(1); // code: Just
    stateInitBits.writeBit(1); // data: Just
    stateInitBits.writeBit(0); // library: Nothing

    return new Cell(stateInitBits.getBits(), [codeCell, dataCell]);
  }

  private async deserializeBocToCell(bocBytes: Uint8Array): Promise<Cell> {
    if (bocBytes[0] !== 0xb5 || bocBytes[1] !== 0xee || bocBytes[2] !== 0x9c || bocBytes[3] !== 0x72) {
      throw new Error("Invalid BOC magic");
    }

    const flagsByte = bocBytes[4];
    const sizeBytes = flagsByte & 0x07;
    const offBytes = bocBytes[5];

    let offset = 6;

    const readSize = (bytes: number): number => {
      let val = 0;
      for (let i = 0; i < bytes; i++) {
        val = (val << 8) | bocBytes[offset++];
      }
      return val;
    };

    const cellCount = readSize(sizeBytes);
    const rootCount = readSize(sizeBytes);
    readSize(sizeBytes); // absent count
    readSize(offBytes); // total cells size

    const rootIndices: number[] = [];
    for (let i = 0; i < rootCount; i++) {
      rootIndices.push(readSize(sizeBytes));
    }

    const cellInfos: { d1: number; d2: number; data: Uint8Array; refIndices: number[] }[] = [];

    for (let i = 0; i < cellCount; i++) {
      const d1 = bocBytes[offset++];
      const d2 = bocBytes[offset++];
      const refsCount = d1 & 0x07;
      const dataByteLen = Math.ceil(d2 / 2);

      const data = bocBytes.slice(offset, offset + dataByteLen);
      offset += dataByteLen;

      const refIndices: number[] = [];
      for (let j = 0; j < refsCount; j++) {
        refIndices.push(readSize(sizeBytes));
      }

      cellInfos.push({ d1, d2, data, refIndices });
    }

    const cells: Cell[] = new Array(cellCount);

    const buildCell = (idx: number): Cell => {
      if (cells[idx]) return cells[idx];

      const info = cellInfos[idx];
      const refs = info.refIndices.map((refIdx) => buildCell(refIdx));

      const bitLen = info.d2 * 4;
      const bits: number[] = [];

      for (let i = 0; i < bitLen && i < info.data.length * 8; i++) {
        const byteIdx = Math.floor(i / 8);
        const bitIdx = 7 - (i % 8);
        bits.push((info.data[byteIdx] >> bitIdx) & 1);
      }

      while (bits.length > 0 && bits[bits.length - 1] === 0) {
        bits.pop();
      }
      if (bits.length > 0) {
        bits.pop();
      }

      cells[idx] = new Cell(bits, refs);
      return cells[idx];
    };

    return buildCell(rootIndices[0]);
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
