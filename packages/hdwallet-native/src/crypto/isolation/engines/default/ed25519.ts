import { ed25519 } from "@noble/curves/ed25519";
import * as bip32crypto from "bip32/src/crypto";

import * as Core from "../../core";
import { ByteArray, checkType, safeBufferFrom } from "../../types";
import { Revocable, revocable } from "./revocable";

export class Node extends Revocable(class {}) implements Core.Ed25519.Node {
  readonly #privateKey: Buffer & ByteArray<32>;
  readonly chainCode: Buffer & Core.BIP32.ChainCode;
  #publicKey: Uint8Array | undefined;

  protected constructor(privateKey: Uint8Array, chainCode: Uint8Array) {
    super();
    if (privateKey.length !== 32) throw new Error("bad private key length");
    this.#privateKey = safeBufferFrom<undefined>(privateKey) as Buffer & ByteArray<32>;
    this.addRevoker(() => this.#privateKey.fill(0));
    this.chainCode = safeBufferFrom(checkType(Core.BIP32.ChainCode, chainCode)) as Buffer & Core.BIP32.ChainCode;
  }

  static async create(privateKey: ByteArray, chainCode: ByteArray): Promise<Node> {
    const obj = new Node(privateKey, chainCode);
    return revocable(obj, (x) => obj.addRevoker(x));
  }

  async getPublicKey(): Promise<Uint8Array> {
    this.#publicKey = this.#publicKey ?? ed25519.getPublicKey(this.#privateKey);
    return this.#publicKey;
  }

  async sign(message: Uint8Array): Promise<Uint8Array> {
    return ed25519.sign(message, this.#privateKey);
  }

  async derive(index: number): Promise<this> {
    if (index < 0x80000000) throw new Error(`Ed25519 requires index ${index} to be hardened`);

    const serP = Buffer.alloc(37);
    serP.set(this.#privateKey, 1);
    serP.writeUInt32BE(index, 33);

    const I = bip32crypto.hmacSHA512(this.chainCode, serP);
    const IL = I.subarray(0, 32);
    const IR = I.subarray(32);

    const out = await Node.create(IL, IR);
    this.addRevoker(() => out.revoke?.());

    return out as this;
  }
}
