import * as core from "@shapeshiftoss/hdwallet-core";
import { createSHA256 } from "hash-wasm";

import { Isolation } from "../..";

const ED25519_PUBLIC_KEY_SIZE = 32;

const WALLET_V4R2_CODE_HASH_HEX = "feb5ff6820e2ff0d9483e7e0d62c817d846789fb4ae580c878866d959dabd5c0";

class BitBuilder {
  private bits: number[] = [];

  writeBit(bit: number): void {
    this.bits.push(bit ? 1 : 0);
  }

  writeUint(value: number, bitCount: number): void {
    for (let i = bitCount - 1; i >= 0; i--) {
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

    const d1 = refsCount;
    const d2 = Math.ceil(bitLen / 8) + Math.floor(bitLen / 8);

    const dataBytes = new Uint8Array(byteLen);
    for (let i = 0; i < bitLen; i++) {
      if (this.bits[i]) {
        dataBytes[Math.floor(i / 8)] |= 1 << (7 - (i % 8));
      }
    }
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

  async signTransaction(message: Uint8Array, addressNList: core.BIP32Path): Promise<string> {
    const nodeAdapter = await this.nodeAdapter.derivePath(core.addressNListToHardenedBIP32(addressNList));
    const signature = await nodeAdapter.node.sign(message);
    return Array.from(signature)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
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
    const codeCell = new CodeCell(this.hexToBytes(WALLET_V4R2_CODE_HASH_HEX), 1);

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
    bits.writeUint(698983191, 32);
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
