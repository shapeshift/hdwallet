import * as core from "@shapeshiftoss/hdwallet-core";
import { createSHA256 } from "hash-wasm";

import { Isolation } from "../..";

const ED25519_PUBLIC_KEY_SIZE = 32;

const WALLET_V4R2_CODE_HEX =
  "b5ee9c72410214010002d4000114ff00f4a413f4bcf2c80b010201200203020148040504f8f28308d71820d31fd31fd31f02f823bbf264ed44d0d31fd31fd3fff404d15143baf2a15151baf2a205f901541064f910f2a3f80024a4c8cb1f5240cb1f5230cbff5210f400c9ed54f80f01d30721c0009f6c519320d74a96d307d402fb00e830e021c001e30021c002e30001c0039130e30d03a4c8cb1f12cb1fcbff1011121302e6d001d0d3032171b0925f04e022d749c120925f04e002d31f218210706c7567bd22821064737472bdb0925f05e003fa403020fa4401c8ca07cbffc9d0ed44d0810140d721f404305c810108f40a6fa131b3925f07e005d33fc8258210706c7567ba923830e30d03821064737472ba925f06e30d06070201200809007801fa00f40430f8276f2230500aa121bef2e0508210706c7567831eb17080185004cb0526cf1658fa0219f400cb6917cb1f5260cb3f20c98040fb0006008a5004810108f45930ed44d0810140d720c801cf16f400c9ed540172b08e23821064737472831eb17080185005cb055003cf1623fa0213cb6acb1fcb3fc98040fb00925f03e20201200a0b0059bd242b6f6a2684080a06b90fa0218470d4080847a4937d29910ce6903e9ff9837812801b7810148987159f31840201580c0d0011b8c97ed44d0d70b1f8003db29dfb513420405035c87d010c00b23281f2fff274006040423d029be84c600201200e0f0019adce76a26840206b90eb85ffc00019af1df6a26840106b90eb858fc0006ed207fa00d4d422f90005c8ca0715cbffc9d077748018c8cb05cb0222cf165005fa0214cb6b12ccccc973fb00c84014810108f451f2a7020070810108d718fa00d33fc8542047810108f451f2a782106e6f746570748018c8cb05cb025006cf165004fa0214cb6a12cb1fcb3fc973fb0002006c810108d718fa00d33f305224810108f459f2a782106473747270748018c8cb05cb025005cf165003fa0213cb6acb1f12cb3fc973fb00000af400c9ed54";

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

    const stateInit = await this.buildWalletV4R2StateInit(publicKey);
    const stateInitHash = await this.sha256(stateInit);

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

  private async buildWalletV4R2StateInit(publicKey: Uint8Array): Promise<Uint8Array> {
    const codeCell = this.hexToBytes(WALLET_V4R2_CODE_HEX);
    const dataCell = this.buildWalletDataCell(publicKey);

    const stateInitCell = this.buildStateInitCell(codeCell, dataCell);
    return stateInitCell;
  }

  private buildWalletDataCell(publicKey: Uint8Array): Uint8Array {
    const builder: number[] = [];

    this.writeUint32(builder, 0);
    this.writeUint32(builder, 698983191);
    for (let i = 0; i < publicKey.length; i++) {
      builder.push(publicKey[i]);
    }
    this.writeUint8(builder, 0);

    return new Uint8Array(builder);
  }

  private buildStateInitCell(codeCell: Uint8Array, dataCell: Uint8Array): Uint8Array {
    const result: number[] = [];

    result.push(0x00);
    result.push(0x00);
    result.push(0x01);

    for (let i = 0; i < codeCell.length; i++) {
      result.push(codeCell[i]);
    }

    result.push(0x01);

    for (let i = 0; i < dataCell.length; i++) {
      result.push(dataCell[i]);
    }

    result.push(0x00);

    return new Uint8Array(result);
  }

  private async sha256(data: Uint8Array): Promise<Uint8Array> {
    const sha256 = await createSHA256();
    sha256.init();
    sha256.update(data);
    return sha256.digest("binary");
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

  private writeUint32(arr: number[], value: number): void {
    arr.push((value >> 24) & 0xff);
    arr.push((value >> 16) & 0xff);
    arr.push((value >> 8) & 0xff);
    arr.push(value & 0xff);
  }

  private writeUint8(arr: number[], value: number): void {
    arr.push(value & 0xff);
  }
}

export default TonAdapter;
