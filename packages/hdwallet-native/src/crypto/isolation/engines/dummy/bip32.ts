import ecc from "@bitcoinerlab/secp256k1";
import { toArrayBuffer } from "@shapeshiftoss/hdwallet-core";
import * as bip32crypto from "bip32/src/crypto";

import { Core } from "../../../isolation";
import { ByteArray, checkType, safeBufferFrom, Uint32 } from "../../types";
import { DummyEngineError, ParsedXpubTree } from "./types";

export * from "../../core/bip32";

export class Node implements Core.BIP32.Node, Core.SecP256K1.ECDSARecoverableKey, Core.SecP256K1.ECDHKey {
  readonly xpubTree: ParsedXpubTree;

  protected constructor(xpubTree: ParsedXpubTree) {
    this.xpubTree = xpubTree;
  }

  static async create(xpubTree: ParsedXpubTree): Promise<Core.BIP32.Node> {
    return new Node(xpubTree);
  }

  async getPublicKey(): Promise<Core.SecP256K1.CompressedPoint> {
    return this.xpubTree.publicKey;
  }

  async getChainCode(): Promise<Core.BIP32.ChainCode> {
    return this.xpubTree.chainCode;
  }

  async ecdsaSign(digestAlgorithm: null, msg: ByteArray<32>, counter?: Uint32): Promise<Core.SecP256K1.Signature>;
  async ecdsaSign(
    digestAlgorithm: Core.Digest.AlgorithmName<32>,
    msg: Uint8Array,
    counter?: Uint32
  ): Promise<Core.SecP256K1.Signature>;
  async ecdsaSign(): Promise<never> {
    throw new DummyEngineError();
  }

  async ecdsaSignRecoverable(
    digestAlgorithm: null,
    msg: ByteArray<32>,
    counter?: Uint32
  ): Promise<Core.SecP256K1.RecoverableSignature>;
  async ecdsaSignRecoverable(
    digestAlgorithm: Core.Digest.AlgorithmName<32>,
    msg: Uint8Array,
    counter?: Uint32
  ): Promise<Core.SecP256K1.RecoverableSignature>;
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
      const Ki = ecc.pointAddScalar(safeBufferFrom(this.xpubTree.publicKey), IL);
      if (Ki === null) throw new Error("Ki is null; this should be cryptographically impossible");

      const newChild = {
        version: this.xpubTree.version,
        depth: this.xpubTree.depth + 1,
        parentFp: this.xpubTree.fingerprint,
        childNum: index,
        chainCode: checkType(Core.BIP32.ChainCode, IR),
        publicKey: checkType(Core.SecP256K1.CompressedPoint, Ki),
        fingerprint: new DataView(toArrayBuffer(Core.Digest.Algorithms.hash160(Ki))).getUint32(0),
        children: new Map(),
      };

      this.xpubTree.children.set(index, newChild);
      return newChild;
    })();
    const out = await Node.create(child);
    return out as this;
  }

  async ecdh(
    publicKey: Core.SecP256K1.CurvePoint,
    digestAlgorithm?: Core.Digest.AlgorithmName<32>
  ): Promise<ByteArray<32>>;
  async ecdh(): Promise<never> {
    throw new DummyEngineError();
  }

  async ecdhRaw(publicKey: Core.SecP256K1.CurvePoint): Promise<Core.SecP256K1.UncompressedPoint>;
  async ecdhRaw(): Promise<never> {
    throw new DummyEngineError();
  }
}

export class Seed implements Core.BIP32.Seed {
  readonly xpubTree: ParsedXpubTree;

  protected constructor(xpubTree: ParsedXpubTree) {
    this.xpubTree = xpubTree;
  }

  static async create(xpubTree: ParsedXpubTree): Promise<Core.BIP32.Seed> {
    return new Seed(xpubTree);
  }

  async toSecp256k1MasterKey(): Promise<Core.BIP32.Node> {
    return Node.create(this.xpubTree);
  }

  async toEd25519MasterKey(): Promise<Core.Ed25519.Node> {
    throw new DummyEngineError();
  }
}
