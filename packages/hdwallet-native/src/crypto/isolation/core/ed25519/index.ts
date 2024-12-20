import {
  ExtendedPoint,
  getPublicKey as nobleGetPublicKey,
  sign as nobleSign,
  verify as nobleVerify,
} from "@noble/ed25519";
import { createHmac } from "crypto";

import { Revocable, revocable } from "../../engines/default/revocable";
import { ByteArray } from "../../types";
import { ChainCode } from "../bip32/types";

export type Ed25519Key = {
  getPublicKey(): Promise<ByteArray>;
  sign(message: Uint8Array): Promise<ByteArray>;
  verify(message: Uint8Array, signature: Uint8Array): Promise<boolean>;
};

export class Ed25519Node extends Revocable(class {}) implements Ed25519Key {
  readonly #privateKey: Buffer;
  readonly #chainCode: Buffer;
  readonly explicitPath?: string;

  protected constructor(privateKey: Uint8Array, chainCode: Uint8Array, explicitPath?: string) {
    super();
    // We avoid handing the private key to any non-platform code
    if (privateKey.length !== 32) throw new Error("bad private key length");
    if (chainCode.length !== 32) throw new Error("bad chain code length");

    this.#privateKey = Buffer.from(privateKey);
    this.#chainCode = Buffer.from(chainCode);
    this.explicitPath = explicitPath;

    this.addRevoker(() => {
      this.#privateKey.fill(0);
      this.#chainCode.fill(0);
    });
  }
  static async fromIsolatedNode(node: any): Promise<Ed25519Node> {
    return new Proxy(node, {
      get(target, prop) {
        if (prop === "sign") {
          return async (message: Uint8Array) => {
            // Use the isolated node's signing capabilities
            return target.sign(message);
          };
        }
        return target[prop];
      },
    });
  }

  static async create(privateKey: Uint8Array, chainCode: Uint8Array, explicitPath?: string): Promise<Ed25519Node> {
    const obj = new Ed25519Node(privateKey, chainCode, explicitPath);
    return revocable(obj, (x) => obj.addRevoker(x));
  }

  async getPublicKey(): Promise<ByteArray> {
    return nobleGetPublicKey(this.#privateKey);
  }

  async sign(message: Uint8Array): Promise<ByteArray> {
    return nobleSign(message, this.#privateKey);
  }

  async verify(message: Uint8Array, signature: Uint8Array): Promise<boolean> {
    const publicKey = await this.getPublicKey();
    return nobleVerify(signature, message, publicKey);
  }

  async getChainCode(): Promise<ChainCode> {
    return this.#chainCode as Buffer & ChainCode;
  }

  async derive(index: number): Promise<Ed25519Node> {
    const indexBuffer = Buffer.alloc(4);
    indexBuffer.writeUInt32BE(index, 0);

    const data = Buffer.concat([
      Buffer.from([0x00]), // Hardened derivation prefix
      this.#privateKey, // Private key
      indexBuffer, // Index
    ]);

    const hmac = createHmac("sha512", this.#chainCode);
    hmac.update(data);
    const I = hmac.digest();

    const IL = I.slice(0, 32); // Private key
    const IR = I.slice(32); // Chain code

    // ED25519 key clamping, whatever that means
    IL[0] &= 0xf8;
    IL[31] &= 0x7f;
    IL[31] |= 0x40;

    const path = this.explicitPath
      ? `${this.explicitPath}/${index >= 0x80000000 ? index - 0x80000000 + "'" : index}`
      : undefined;

    return Ed25519Node.create(IL, IR, path);
  }
}

export type Point = ExtendedPoint;
export const Ed25519Point = {
  BASE_POINT: nobleGetPublicKey(new Uint8Array(32)),
};
export type { ExtendedPoint };
