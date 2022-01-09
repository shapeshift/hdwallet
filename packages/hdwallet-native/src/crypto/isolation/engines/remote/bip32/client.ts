import { RemoteClient, revocable } from "@shapeshiftoss/hdwallet-core";

import { Digest, SecP256K1 } from "../../../core";
import * as BIP32 from "../../../core/bip32";
import { ByteArray, Uint32, checkType, safeBufferFrom } from "../../../types";

export class Seed extends RemoteClient implements BIP32.Seed {
  protected constructor(messagePort: MessagePort) {
    super(messagePort)
    this.addRevoker(() => this.call("revoke"))
  }

  static async create(messagePort: MessagePort): Promise<Seed> {
    const obj = new Seed(messagePort);
    return revocable(obj, (x) => obj.addRevoker(x));
  }

  async toMasterKey(hmacKey?: string | Uint8Array): Promise<Node> {
    if (hmacKey !== undefined && typeof hmacKey !== "string" && !(hmacKey instanceof Uint8Array)) throw new Error("bad hmacKey type");
    const out = await Node.create(await this.call("toMasterKey", hmacKey));
    this.addRevoker(() => out.revoke());
    return out;
  }
}

export type NodeParams = {
  publicKey: Uint8Array
  chainCode: Uint8Array
  port: MessagePort
}

export class Node extends RemoteClient implements BIP32.Node, SecP256K1.ECDSARecoverableKey, SecP256K1.ECDHKey {
  readonly chainCode: Buffer & BIP32.ChainCode;
  readonly publicKey: SecP256K1.CompressedPoint;

  protected constructor(params: NodeParams) {
    super(params.port)
    this.publicKey = checkType(SecP256K1.CompressedPoint, params.publicKey)
    this.chainCode = safeBufferFrom(checkType(BIP32.ChainCode, params.chainCode)) as Buffer & BIP32.ChainCode;
    this.addRevoker(() => this.call("revoke"))
  }

  static async create(params: NodeParams): Promise<Node> {
    const obj = new Node(params);
    return revocable(obj, (x) => obj.addRevoker(x));
  }

  getPublicKey() { return this.publicKey }
  getChainCode() { return this.chainCode }

  async ecdsaSign(digestAlgorithm: null, msg: ByteArray<32>, counter?: Uint32): Promise<SecP256K1.Signature>
  async ecdsaSign(digestAlgorithm: Digest.AlgorithmName<32>, msg: Uint8Array, counter?: Uint32): Promise<SecP256K1.Signature>
  async ecdsaSign(digestAlgorithm: Digest.AlgorithmName<32> | null, msg: Uint8Array, counter?: Uint32): Promise<SecP256K1.Signature> {
    return checkType(SecP256K1.Signature, await this.call("ecdsaSign", digestAlgorithm, msg, counter))
  }

  async ecdsaSignRecoverable(digestAlgorithm: null, msg: ByteArray<32>, counter?: Uint32): Promise<SecP256K1.RecoverableSignature>
  async ecdsaSignRecoverable(digestAlgorithm: Digest.AlgorithmName<32>, msg: Uint8Array, counter?: Uint32): Promise<SecP256K1.RecoverableSignature>
  async ecdsaSignRecoverable(digestAlgorithm: Digest.AlgorithmName<32> | null, msg: Uint8Array, counter?: Uint32): Promise<SecP256K1.RecoverableSignature> {
    return checkType(SecP256K1.RecoverableSignature, await this.call("ecdsaSignRecoverable", digestAlgorithm, msg, counter))
  }

  async derive(index: Uint32): Promise<this> {
    const out = await Node.create(await this.call("derive", index));
    this.addRevoker(() => out.revoke())
    return out as this;
  }

  async ecdh(publicKey: SecP256K1.CurvePoint, digestAlgorithm?: Digest.AlgorithmName<32>): Promise<ByteArray<32>> {
    SecP256K1.CurvePoint.assert(publicKey);
    digestAlgorithm === undefined || Digest.AlgorithmName(32).assert(digestAlgorithm);

    return checkType(ByteArray(32), await this.call("ecdh", publicKey, digestAlgorithm));
  }

  async ecdhRaw(publicKey: SecP256K1.CurvePoint): Promise<SecP256K1.UncompressedPoint> {
    return checkType(SecP256K1.UncompressedPoint, await this.call("ecdhRaw", publicKey));
  }
}
