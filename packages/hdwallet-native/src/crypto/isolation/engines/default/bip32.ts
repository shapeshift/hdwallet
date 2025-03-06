import ecc from "@bitcoinerlab/secp256k1";
import * as bip32crypto from "bip32/src/crypto";

import { Core } from "../../../isolation";
import { assertType, ByteArray, checkType, safeBufferFrom, Uint32 } from "../../types";
import * as Ed25519 from "./ed25519";
import { Revocable, revocable } from "./revocable";

export * from "../../core/bip32";

export class Node
  extends Revocable(class {})
  implements Core.BIP32.Node, Core.SecP256K1.ECDSARecoverableKey, Core.SecP256K1.ECDHKey
{
  readonly #privateKey: Buffer & ByteArray<32>;
  readonly chainCode: Buffer & Core.BIP32.ChainCode;
  #publicKey: Core.SecP256K1.CompressedPoint | undefined;
  readonly explicitPath?: string;

  protected constructor(privateKey: Uint8Array, chainCode: Uint8Array, explicitPath?: string) {
    super();
    // We avoid handing the private key to any non-platform code -- including our type-checking machinery.
    if (privateKey.length !== 32) throw new Error("bad private key length");
    this.#privateKey = safeBufferFrom<undefined>(privateKey) as Buffer & ByteArray<32>;
    this.addRevoker(() => this.#privateKey.fill(0));
    this.chainCode = safeBufferFrom(checkType(Core.BIP32.ChainCode, chainCode)) as Buffer & Core.BIP32.ChainCode;
    this.explicitPath = explicitPath;
  }

  static async create(privateKey: Uint8Array, chainCode: Uint8Array, explicitPath?: string): Promise<Core.BIP32.Node> {
    const obj = new Node(privateKey, chainCode, explicitPath);
    return revocable(obj, (x) => obj.addRevoker(x));
  }

  async getPublicKey(): Promise<Core.SecP256K1.CompressedPoint> {
    this.#publicKey =
      this.#publicKey ?? checkType(Core.SecP256K1.CompressedPoint, ecc.pointFromScalar(this.#privateKey, true));
    return this.#publicKey;
  }

  async getChainCode() {
    return this.chainCode;
  }

  async ecdsaSign(digestAlgorithm: null, msg: ByteArray<32>, counter?: Uint32): Promise<Core.SecP256K1.Signature>;
  async ecdsaSign(
    digestAlgorithm: Core.Digest.AlgorithmName<32>,
    msg: Uint8Array,
    counter?: Uint32
  ): Promise<Core.SecP256K1.Signature>;
  async ecdsaSign(
    digestAlgorithm: Core.Digest.AlgorithmName<32> | null,
    msg: Uint8Array,
    counter?: Uint32
  ): Promise<Core.SecP256K1.Signature> {
    const recoverableSig = await (async () => {
      if (digestAlgorithm === null) {
        assertType(ByteArray(32), msg);
        return await this.ecdsaSignRecoverable(digestAlgorithm, msg, counter);
      } else {
        return await this.ecdsaSignRecoverable(digestAlgorithm, msg, counter);
      }
    })();
    return Core.SecP256K1.RecoverableSignature.sig(recoverableSig);
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
  async ecdsaSignRecoverable(
    digestAlgorithm: Core.Digest.AlgorithmName<32> | null,
    msg: Uint8Array,
    counter?: Uint32
  ): Promise<Core.SecP256K1.RecoverableSignature> {
    counter === undefined || Uint32.assert(counter);
    digestAlgorithm === null || Core.Digest.AlgorithmName(32).assert(digestAlgorithm);

    const msgOrDigest =
      digestAlgorithm === null
        ? checkType(ByteArray(32), msg)
        : Core.Digest.Algorithms[digestAlgorithm](checkType(ByteArray(), msg));
    const entropy = counter === undefined ? undefined : Buffer.alloc(32);
    entropy?.writeUInt32BE(counter ?? 0, 24);
    return await Core.SecP256K1.RecoverableSignature.fromSignature(
      checkType(Core.SecP256K1.Signature, ecc.sign(Buffer.from(msgOrDigest), this.#privateKey, entropy)),
      null,
      msgOrDigest,
      await this.getPublicKey()
    );
  }

  async derive(index: Uint32): Promise<this> {
    Uint32.assert(index);

    const serP = Buffer.alloc(37);
    if (index < 0x80000000) {
      serP.set(Core.SecP256K1.CompressedPoint.from(await this.getPublicKey()), 0);
    } else {
      serP.set(this.#privateKey, 1);
    }
    serP.writeUInt32BE(index, 33);

    const I = bip32crypto.hmacSHA512(this.chainCode, serP);
    const IL = I.slice(0, 32);
    const IR = I.slice(32, 64);
    const ki = ecc.privateAdd(this.#privateKey, IL);
    if (ki === null) throw new Error("ki is null; this should be cryptographically impossible");
    const out = await Node.create(ki, IR);
    this.addRevoker(() => out.revoke?.());
    return out as this;
  }

  async ecdh(
    publicKey: Core.SecP256K1.CurvePoint,
    digestAlgorithm?: Core.Digest.AlgorithmName<32>
  ): Promise<ByteArray<32>> {
    Core.SecP256K1.CurvePoint.assert(publicKey);
    digestAlgorithm === undefined || Core.Digest.AlgorithmName(32).assert(digestAlgorithm);

    return checkType(ByteArray(32), await this._ecdh(publicKey, digestAlgorithm));
  }

  async ecdhRaw(publicKey: Core.SecP256K1.CurvePoint): Promise<Core.SecP256K1.UncompressedPoint> {
    return checkType(Core.SecP256K1.UncompressedPoint, await this._ecdh(publicKey, null));
  }

  private async _ecdh(
    publicKey: Core.SecP256K1.CurvePoint,
    digestAlgorithm?: Core.Digest.AlgorithmName<32> | null
  ): Promise<ByteArray<32> | Core.SecP256K1.UncompressedPoint> {
    Core.SecP256K1.CurvePoint.assert(publicKey);
    digestAlgorithm === undefined || digestAlgorithm === null || Core.Digest.AlgorithmName(32).assert(digestAlgorithm);

    const sharedFieldElement = checkType(
      Core.SecP256K1.UncompressedPoint,
      ecc.pointMultiply(Buffer.from(publicKey), this.#privateKey, false)
    );
    if (digestAlgorithm === null) return sharedFieldElement;

    let out = Core.SecP256K1.CurvePoint.x(sharedFieldElement);
    if (digestAlgorithm !== undefined) out = Core.Digest.Algorithms[digestAlgorithm](out);
    return out;
  }
}

// https://github.com/satoshilabs/slips/blob/master/slip-0010.md
export class Seed extends Revocable(class {}) implements Core.BIP32.Seed {
  readonly #seed: Buffer;

  protected constructor(seed: Uint8Array) {
    super();
    this.#seed = safeBufferFrom(seed);
    this.addRevoker(() => this.#seed.fill(0));
  }

  static async create(seed: Uint8Array): Promise<Core.BIP32.Seed> {
    const obj = new Seed(seed);
    return revocable(obj, (x) => obj.addRevoker(x));
  }

  async toSecp256k1MasterKey(): Promise<Core.BIP32.Node> {
    const hmacKey = safeBufferFrom(new TextEncoder().encode("Bitcoin seed"));
    const I = safeBufferFrom(bip32crypto.hmacSHA512(safeBufferFrom(hmacKey), this.#seed));
    const IL = I.subarray(0, 32);
    const IR = I.subarray(32, 64);
    const out = await Node.create(IL, IR);
    this.addRevoker(() => out.revoke?.());
    return out;
  }

  async toEd25519MasterKey(): Promise<Core.Ed25519.Node> {
    const hmacKey = safeBufferFrom(new TextEncoder().encode("ed25519 seed"));
    const I = safeBufferFrom(bip32crypto.hmacSHA512(hmacKey, this.#seed));
    const IL = I.subarray(0, 32);
    const IR = I.subarray(32, 64);
    const out = await Ed25519.Node.create(IL, IR);
    this.addRevoker(() => out.revoke?.());
    return out;
  }
}
