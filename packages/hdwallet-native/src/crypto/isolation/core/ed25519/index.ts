import { ExtPointConstructor } from "@noble/curves/abstract/edwards";
import { ed25519 } from "@noble/curves/ed25519";
import * as bip32crypto from "bip32/src/crypto";

import { Revocable, revocable } from "../../engines/default/revocable";
import { ByteArray } from "../../types";

export type Ed25519Key = {
  getPublicKey(): Promise<ByteArray>;
  sign(message: Uint8Array): Promise<ByteArray>;
  verify(message: Uint8Array, signature: Uint8Array): Promise<boolean>;
};

export class Ed25519Node extends Revocable(class {}) {
  readonly #privateKey: ByteArray;
  readonly #chainCode: ByteArray;
  readonly explicitPath?: string;

  protected constructor(privateKey: ByteArray, chainCode: ByteArray, explicitPath?: string) {
    super();
    this.#privateKey = privateKey;
    this.#chainCode = chainCode;
    this.explicitPath = explicitPath;
  }

  static async create(privateKey: ByteArray, chainCode: ByteArray, explicitPath?: string): Promise<Ed25519Node> {
    const obj = new Ed25519Node(privateKey, chainCode, explicitPath);
    return revocable(obj, (x) => obj.addRevoker(x));
  }

  async getPublicKey(): Promise<ByteArray> {
    // Generate public key from private key
    return Buffer.from(ed25519.getPublicKey(this.#privateKey));
  }

  async getChainCode(): Promise<ByteArray> {
    return this.#chainCode;
  }

  async sign(message: Uint8Array): Promise<ByteArray> {
    return Buffer.from(ed25519.sign(message, this.#privateKey));
  }

  async derive(index: number): Promise<Ed25519Node> {
    // Ensure hardened derivation
    if (index < 0x80000000) {
      index += 0x80000000;
    }

    const indexBuffer = Buffer.alloc(4);
    indexBuffer.writeUInt32BE(index, 0);

    // SLIP-0010 for Ed25519
    const data = Buffer.concat([Buffer.from([0x00]), Buffer.from(this.#privateKey), indexBuffer]);

    const I = bip32crypto.hmacSHA512(Buffer.from(this.#chainCode), data);
    const IL = I.slice(0, 32);
    const IR = I.slice(32);

    // Ed25519 clamping
    IL[0] &= 0xf8;
    IL[31] &= 0x7f;
    IL[31] |= 0x40;

    const path = this.explicitPath
      ? `${this.explicitPath}/${index >= 0x80000000 ? index - 0x80000000 + "'" : index}`
      : undefined;

    return Ed25519Node.create(IL, IR, path);
  }
}

export type Point = ExtPointConstructor;
export const Ed25519Point = {
  BASE_POINT: ed25519.getPublicKey(new Uint8Array(32)),
};
export type { Point as ExtendedPoint };
