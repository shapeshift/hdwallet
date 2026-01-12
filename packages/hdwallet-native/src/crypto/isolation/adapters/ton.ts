import * as core from "@shapeshiftoss/hdwallet-core";
import { createSHA256 } from "hash-wasm";

import { Isolation } from "../..";

const ED25519_PUBLIC_KEY_SIZE = 32;

// Wallet V4R2 contract code cell (already serialized as BOC)
const WALLET_V4R2_CODE_BOC_HEX =
  "b5ee9c72410214010002d4000114ff00f4a413f4bcf2c80b010201200203020148040504f8f28308d71820d31fd31fd31f02f823bbf264ed44d0d31fd31fd3fff404d15143baf2a15151baf2a205f901541064f910f2a3f80024a4c8cb1f5240cb1f5230cbff5210f400c9ed54f80f01d30721c0009f6c519320d74a96d307d402fb00e830e021c001e30021c002e30001c0039130e30d03a4c8cb1f12cb1fcbff1011121302e6d001d0d3032171b0925f04e022d749c120925f04e002d31f218210706c7567bd22821064737472bdb0925f05e003fa403020fa4401c8ca07cbffc9d0ed44d0810140d721f404305c810108f40a6fa131b3925f07e005d33fc8258210706c7567ba923830e30d03821064737472ba925f06e30d06070201200809007801fa00f40430f8276f2230500aa121bef2e0508210706c7567831eb17080185004cb0526cf1658fa0219f400cb6917cb1f5260cb3f20c98040fb0006008a5004810108f45930ed44d0810140d720c801cf16f400c9ed540172b08e23821064737472831eb17080185005cb055003cf1623fa0213cb6acb1fcb3fc98040fb00925f03e20201200a0b0059bd242b6f6a2684080a06b90fa0218470d4080847a4937d29910ce6903e9ff9837812801b7810148987159f31840201580c0d0011b8c97ed44d0d70b1f8003db29dfb513420405035c87d010c00b23281f2fff274006040423d029be84c600201200e0f0019adce76a26840206b90eb85ffc00019af1df6a26840106b90eb858fc0006ed207fa00d4d422f90005c8ca0715cbffc9d077748018c8cb05cb0222cf165005fa0214cb6b12ccccc973fb00c84014810108f451f2a7020070810108d718fa00d33fc8542047810108f451f2a782106e6f746570748018c8cb05cb025006cf165004fa0214cb6a12cb1fcb3fc973fb0002006c810108d718fa00d33f305224810108f459f2a782106473747270748018c8cb05cb025005cf165003fa0213cb6acb1f12cb3fc973fb00000af400c9ed54";

// Pre-computed code cell hash for V4R2 wallet
const WALLET_V4R2_CODE_HASH_HEX = "feb5ff6820e2ff0d9483e7e0d62c817d846789fb4ae580c878866d959dabd5c0";

/**
 * BitBuilder - builds bits for TON Cell serialization
 */
class BitBuilder {
  private bits: number[] = [];

  writeBit(bit: number): void {
    this.bits.push(bit ? 1 : 0);
  }

  writeBits(bits: number[]): void {
    for (const bit of bits) {
      this.writeBit(bit);
    }
  }

  writeUint(value: number, bits: number): void {
    for (let i = bits - 1; i >= 0; i--) {
      this.writeBit((value >> i) & 1);
    }
  }

  writeBytes(bytes: Uint8Array): void {
    for (const byte of bytes) {
      this.writeUint(byte, 8);
    }
  }

  getBitLength(): number {
    return this.bits.length;
  }

  // Convert bits to bytes, padding with completion tag if needed
  toBytes(): Uint8Array {
    const bitLen = this.bits.length;
    // Calculate bytes needed (with completion tag if not byte-aligned)
    const byteLen = Math.ceil(bitLen / 8);
    const result = new Uint8Array(byteLen);

    for (let i = 0; i < bitLen; i++) {
      if (this.bits[i]) {
        result[Math.floor(i / 8)] |= 1 << (7 - (i % 8));
      }
    }

    // Add completion tag if not byte-aligned
    if (bitLen % 8 !== 0) {
      const lastByteIdx = byteLen - 1;
      const usedBits = bitLen % 8;
      // Set completion bit (1 followed by zeros)
      result[lastByteIdx] |= 1 << (7 - usedBits);
    }

    return result;
  }

  getBits(): number[] {
    return [...this.bits];
  }
}

/**
 * Cell - TON Cell representation
 */
class Cell {
  readonly bits: number[];
  readonly refs: Cell[];

  constructor(bits: number[] = [], refs: Cell[] = []) {
    this.bits = bits;
    this.refs = refs;
  }

  /**
   * Get cell representation for hashing
   * Format: d1 d2 [data bytes] [ref hashes...]
   */
  async getRepr(): Promise<Uint8Array> {
    const bitLen = this.bits.length;
    const byteLen = Math.ceil(bitLen / 8);
    const augmented = bitLen % 8 !== 0;

    // d1: refs count (3 bits) + 0 (1 bit) + data bytes high (2 bits) + special (1 bit) + level (3 bits)
    // For ordinary cell: refs_count * 2 + has_data_floor_flag
    const refsCount = this.refs.length;
    const d1 = refsCount + (refsCount > 0 ? 0 : 0) + (byteLen > 0 ? 0 : 0);

    // Simplified d1/d2 calculation for ordinary cells
    // d1 = refs_descriptor = refs_count + 8 * is_exotic + 32 * level_mask
    // d2 = bits_descriptor = ceil(bits/8) + floor(bits/8)
    const d1Byte = refsCount;
    const d2Byte = Math.ceil(bitLen / 8) + Math.floor(bitLen / 8);

    // Convert bits to bytes with completion tag
    const dataBytes = new Uint8Array(byteLen);
    for (let i = 0; i < bitLen; i++) {
      if (this.bits[i]) {
        dataBytes[Math.floor(i / 8)] |= 1 << (7 - (i % 8));
      }
    }
    // Add completion tag if not byte-aligned
    if (augmented && byteLen > 0) {
      const lastByteIdx = byteLen - 1;
      const usedBits = bitLen % 8;
      dataBytes[lastByteIdx] |= 1 << (7 - usedBits);
    }

    // Collect ref hashes
    const refHashes: Uint8Array[] = [];
    for (const ref of this.refs) {
      refHashes.push(await ref.hash());
    }

    // Build representation
    const totalLen = 2 + byteLen + refHashes.length * 32;
    const repr = new Uint8Array(totalLen);
    repr[0] = d1Byte;
    repr[1] = d2Byte;
    repr.set(dataBytes, 2);

    let offset = 2 + byteLen;
    for (const refHash of refHashes) {
      repr.set(refHash, offset);
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

    // Build StateInit and compute hash
    const stateInitHash = await this.computeWalletV4R2Address(publicKey);

    const workchain = 0;
    return this.formatUserFriendlyAddress(workchain, stateInitHash, false, false);
  }

  async signTransaction(message: Uint8Array, addressNList: core.BIP32Path): Promise<string> {
    const nodeAdapter = await this.nodeAdapter.derivePath(core.addressNListToHardenedBIP32(addressNList));
    const signature = await nodeAdapter.node.sign(message);

    const signatureHex = Array.from(signature)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    return signatureHex;
  }

  async getPublicKey(addressNList: core.BIP32Path): Promise<string> {
    const nodeAdapter = await this.nodeAdapter.derivePath(core.addressNListToHardenedBIP32(addressNList));
    const publicKey = await nodeAdapter.getPublicKey();

    const publicKeyHex = Array.from(publicKey)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    return publicKeyHex;
  }

  /**
   * Compute wallet V4R2 address from public key
   * Address = SHA256(StateInit)
   * StateInit = split_depth:0 special:0 code:^CodeCell data:^DataCell library:0
   */
  private async computeWalletV4R2Address(publicKey: Uint8Array): Promise<Uint8Array> {
    // Build data cell
    const dataCell = this.buildDataCell(publicKey);

    // Build code cell from pre-computed hash (we use the hash directly)
    const codeHash = this.hexToBytes(WALLET_V4R2_CODE_HASH_HEX);

    // Build StateInit cell
    // StateInit structure (5 bits + refs):
    // - split_depth: Maybe (0 = nothing)
    // - special: Maybe (0 = nothing)
    // - code: Maybe Cell (1 = present)
    // - data: Maybe Cell (1 = present)
    // - library: HashmapE 256 (0 = empty)
    const stateInitBits = new BitBuilder();
    stateInitBits.writeBit(0); // split_depth: nothing
    stateInitBits.writeBit(0); // special: nothing
    stateInitBits.writeBit(1); // code: present
    stateInitBits.writeBit(1); // data: present
    stateInitBits.writeBit(0); // library: empty

    // For StateInit hash, we need to include:
    // d1 d2 [data bits as bytes] [code cell hash] [data cell hash]
    const stateInitCell = new Cell(stateInitBits.getBits(), [await this.createCodeCellFromHash(codeHash), dataCell]);

    return stateInitCell.hash();
  }

  /**
   * Create a placeholder cell with known hash (for code cell)
   */
  private async createCodeCellFromHash(hash: Uint8Array): Promise<Cell> {
    // We create a special cell that will return the known hash
    // This is a workaround since we don't want to deserialize the full code BOC
    return new (class extends Cell {
      constructor(private knownHash: Uint8Array) {
        super();
      }
      async hash(): Promise<Uint8Array> {
        return this.knownHash;
      }
    })(hash);
  }

  /**
   * Build wallet data cell
   * Data: seqno:uint32 subwallet_id:uint32 public_key:bits256 plugins:dict
   */
  private buildDataCell(publicKey: Uint8Array): Cell {
    const bits = new BitBuilder();

    // seqno: uint32 = 0
    bits.writeUint(0, 32);

    // subwallet_id: uint32 = 698983191 (default for workchain 0)
    bits.writeUint(698983191, 32);

    // public_key: bits256
    bits.writeBytes(publicKey);

    // plugins: dict = empty (1 bit = 0 for empty dict)
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
    if (isTestnet) {
      tag |= 0x80;
    }

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
        if (crc & 0x8000) {
          crc = ((crc << 1) ^ POLY) & 0xffff;
        } else {
          crc = (crc << 1) & 0xffff;
        }
      }
    }

    return crc;
  }

  private base64UrlEncode(data: Uint8Array): string {
    let binary = "";
    for (let i = 0; i < data.length; i++) {
      binary += String.fromCharCode(data[i]);
    }
    const base64 = btoa(binary);
    return base64.replace(/\+/g, "-").replace(/\//g, "_");
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
