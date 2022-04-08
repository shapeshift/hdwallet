import { toArrayBuffer } from "@shapeshiftoss/hdwallet-core";
import * as bip32crypto from "bip32/src/crypto";
import * as tinyecc from "tiny-secp256k1";

import { BIP32, Digest, SecP256K1 } from "../../core";
import { ByteArray, checkType, safeBufferFrom, Uint32 } from "../../types";
import { DummyEngineError, ParsedXpubTree } from "./types";

export * from "../../core/bip32";

export class Node implements BIP32.Node, SecP256K1.ECDSARecoverableKey, SecP256K1.ECDHKey {
  readonly xpubTree: ParsedXpubTree;

  protected constructor(xpubTree: ParsedXpubTree) {
    this.xpubTree = xpubTree;
  }

  static async create(xpubTree: ParsedXpubTree): Promise<BIP32.Node> {
    return new Node(xpubTree);
  }

  async getPublicKey(): Promise<SecP256K1.CompressedPoint> {
    return this.xpubTree.publicKey;
  }

  async getChainCode(): Promise<BIP32.ChainCode> {
    return this.xpubTree.chainCode;
  }

  async ecdsaSign(digestAlgorithm: null, msg: ByteArray<32>, counter?: Uint32): Promise<SecP256K1.Signature>;
  async ecdsaSign(
    digestAlgorithm: Digest.AlgorithmName<32>,
    msg: Uint8Array,
    counter?: Uint32
  ): Promise<SecP256K1.Signature>;
  async ecdsaSign(): Promise<never> {
    throw new DummyEngineError();
  }

  async ecdsaSignRecoverable(
    digestAlgorithm: null,
    msg: ByteArray<32>,
    counter?: Uint32
  ): Promise<SecP256K1.RecoverableSignature>;
  async ecdsaSignRecoverable(
    digestAlgorithm: Digest.AlgorithmName<32>,
    msg: Uint8Array,
    counter?: Uint32
  ): Promise<SecP256K1.RecoverableSignature>;
  async ecdsaSignRecoverable(): Promise<never> {
    throw new DummyEngineError();
  }

  async derive(index: Uint32): Promise<this> {
    Uint32.assert(index);
    const child = (() => {
      const existingChild = this.xpubTree.children.get(index);
      if (existingChild) return existingChild;

      if (index >= 0x80000000) throw new DummyEngineError();

      const serP = Buffer.alloc(37);
      serP.set(this.xpubTree.publicKey, 0);
      serP.writeUInt32BE(index, 33);
      const I = bip32crypto.hmacSHA512(safeBufferFrom(this.xpubTree.chainCode), serP);
      const IL = I.slice(0, 32);
      const IR = I.slice(32, 64);
      const Ki = tinyecc.pointAddScalar(safeBufferFrom(this.xpubTree.publicKey), IL);
      if (Ki === null) throw new Error("Ki is null; this should be cryptographically impossible");

      const newChild = {
        version: this.xpubTree.version,
        depth: this.xpubTree.depth + 1,
        parentFp: this.xpubTree.fingerprint,
        childNum: index,
        chainCode: checkType(BIP32.ChainCode, IR),
        publicKey: checkType(SecP256K1.CompressedPoint, Ki),
        fingerprint: new DataView(toArrayBuffer(Digest.Algorithms.hash160(Ki))).getUint32(0),
        children: new Map(),
      };

      this.xpubTree.children.set(index, newChild);
      return newChild;
    })();
    const out = await Node.create(child);
    return out as this;
  }

  async ecdh(publicKey: SecP256K1.CurvePoint, digestAlgorithm?: Digest.AlgorithmName<32>): Promise<ByteArray<32>>;
  async ecdh(): Promise<never> {
    throw new DummyEngineError();
  }

  async ecdhRaw(publicKey: SecP256K1.CurvePoint): Promise<SecP256K1.UncompressedPoint>;
  async ecdhRaw(): Promise<never> {
    throw new DummyEngineError();
  }
}

export class Seed implements BIP32.Seed {
  readonly xpubTree: ParsedXpubTree;

  protected constructor(xpubTree: ParsedXpubTree) {
    this.xpubTree = xpubTree;
  }

  static async create(xpubTree: ParsedXpubTree): Promise<BIP32.Seed> {
    return new Seed(xpubTree);
  }

  toMasterKey(): Promise<BIP32.Node>;
  toMasterKey(hmacKey: string | Uint8Array): never;
  async toMasterKey(hmacKey?: string | Uint8Array): Promise<BIP32.Node> {
    if (hmacKey !== undefined) throw new Error("bad hmacKey type");

    return await Node.create(this.xpubTree);
  }
}
