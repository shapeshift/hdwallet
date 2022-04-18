import * as bip32crypto from "bip32/src/crypto";
import * as tinyecc from "tiny-secp256k1";
import { TextEncoder } from "web-encoding";

import { BIP32, Digest, SecP256K1 } from "../../core";
import { assertType, ByteArray, checkType, safeBufferFrom, Uint32 } from "../../types";
import { Revocable, revocable } from "./revocable";

export * from "../../core/bip32";

export class Node extends Revocable(class {}) implements BIP32.Node, SecP256K1.ECDSARecoverableKey, SecP256K1.ECDHKey {
  readonly #privateKey: Buffer & ByteArray<32>;
  readonly chainCode: Buffer & BIP32.ChainCode;
  #publicKey: SecP256K1.CompressedPoint | undefined;

  // When running tests, this will keep us aware of any codepaths that don't pass in the preimage
  static requirePreimage = typeof expect === "function";

  protected constructor(privateKey: Uint8Array, chainCode: Uint8Array) {
    super();
    // We avoid handing the private key to any non-platform code -- including our type-checking machinery.
    if (privateKey.length !== 32) throw new Error("bad private key length");
    this.#privateKey = safeBufferFrom(privateKey) as Buffer & ByteArray<32>;
    this.addRevoker(() => this.#privateKey.fill(0));
    this.chainCode = safeBufferFrom(checkType(BIP32.ChainCode, chainCode)) as Buffer & BIP32.ChainCode;
  }

  static async create(privateKey: Uint8Array, chainCode: Uint8Array): Promise<BIP32.Node> {
    const obj = new Node(privateKey, chainCode);
    return revocable(obj, (x) => obj.addRevoker(x));
  }

  async getPublicKey(): Promise<SecP256K1.CompressedPoint> {
    this.#publicKey =
      this.#publicKey ?? checkType(SecP256K1.CompressedPoint, tinyecc.pointFromScalar(this.#privateKey, true));
    return this.#publicKey;
  }

  async getChainCode() {
    return this.chainCode;
  }

  async ecdsaSign(digestAlgorithm: null, msg: ByteArray<32>, counter?: Uint32): Promise<SecP256K1.Signature>;
  async ecdsaSign(
    digestAlgorithm: Digest.AlgorithmName<32>,
    msg: Uint8Array,
    counter?: Uint32
  ): Promise<SecP256K1.Signature>;
  async ecdsaSign(
    digestAlgorithm: Digest.AlgorithmName<32> | null,
    msg: Uint8Array,
    counter?: Uint32
  ): Promise<SecP256K1.Signature> {
    const recoverableSig = await (async () => {
      if (digestAlgorithm === null) {
        assertType(ByteArray(32), msg);
        return await this.ecdsaSignRecoverable(digestAlgorithm, msg, counter);
      } else {
        return await this.ecdsaSignRecoverable(digestAlgorithm, msg, counter);
      }
    })();
    return SecP256K1.RecoverableSignature.sig(recoverableSig);
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
  async ecdsaSignRecoverable(
    digestAlgorithm: Digest.AlgorithmName<32> | null,
    msg: Uint8Array,
    counter?: Uint32
  ): Promise<SecP256K1.RecoverableSignature> {
    counter === undefined || Uint32.assert(counter);
    digestAlgorithm === null || Digest.AlgorithmName(32).assert(digestAlgorithm);

    if (Node.requirePreimage && digestAlgorithm === null) throw TypeError("preimage required");

    const msgOrDigest =
      digestAlgorithm === null
        ? checkType(ByteArray(32), msg)
        : Digest.Algorithms[digestAlgorithm](checkType(ByteArray(), msg));
    const entropy = counter === undefined ? undefined : Buffer.alloc(32);
    entropy?.writeUInt32BE(counter ?? 0, 24);
    return await SecP256K1.RecoverableSignature.fromSignature(
      checkType(
        SecP256K1.Signature,
        (
          tinyecc as typeof tinyecc & {
            signWithEntropy: (message: Buffer, privateKey: Buffer, entropy?: Buffer) => Buffer;
          }
        ).signWithEntropy(Buffer.from(msgOrDigest), this.#privateKey, entropy)
      ),
      null,
      msgOrDigest,
      await this.getPublicKey()
    );
  }

  async derive(index: Uint32): Promise<this> {
    Uint32.assert(index);

    const serP = Buffer.alloc(37);
    if (index < 0x80000000) {
      serP.set(SecP256K1.CompressedPoint.from(await this.getPublicKey()), 0);
    } else {
      serP.set(this.#privateKey, 1);
    }
    serP.writeUInt32BE(index, 33);

    const I = bip32crypto.hmacSHA512(this.chainCode, serP);
    const IL = I.slice(0, 32);
    const IR = I.slice(32, 64);
    const ki = tinyecc.privateAdd(this.#privateKey, IL);
    if (ki === null) throw new Error("ki is null; this should be cryptographically impossible");
    const out = await Node.create(ki, IR);
    this.addRevoker(() => out.revoke?.());
    return out as this;
  }

  async ecdh(publicKey: SecP256K1.CurvePoint, digestAlgorithm?: Digest.AlgorithmName<32>): Promise<ByteArray<32>> {
    SecP256K1.CurvePoint.assert(publicKey);
    digestAlgorithm === undefined || Digest.AlgorithmName(32).assert(digestAlgorithm);

    return checkType(ByteArray(32), await this._ecdh(publicKey, digestAlgorithm));
  }

  async ecdhRaw(publicKey: SecP256K1.CurvePoint): Promise<SecP256K1.UncompressedPoint> {
    return checkType(SecP256K1.UncompressedPoint, await this._ecdh(publicKey, null));
  }

  private async _ecdh(
    publicKey: SecP256K1.CurvePoint,
    digestAlgorithm?: Digest.AlgorithmName<32> | null
  ): Promise<ByteArray<32> | SecP256K1.UncompressedPoint> {
    SecP256K1.CurvePoint.assert(publicKey);
    digestAlgorithm === undefined || digestAlgorithm === null || Digest.AlgorithmName(32).assert(digestAlgorithm);

    const sharedFieldElement = checkType(
      SecP256K1.UncompressedPoint,
      tinyecc.pointMultiply(Buffer.from(publicKey), this.#privateKey, false)
    );
    if (digestAlgorithm === null) return sharedFieldElement;

    let out = SecP256K1.CurvePoint.x(sharedFieldElement);
    if (digestAlgorithm !== undefined) out = Digest.Algorithms[digestAlgorithm](out);
    return out;
  }
}

export class Seed extends Revocable(class {}) implements BIP32.Seed {
  readonly #seed: Buffer;

  protected constructor(seed: Uint8Array) {
    super();
    this.#seed = safeBufferFrom(seed);
    this.addRevoker(() => this.#seed.fill(0));
  }

  static async create(seed: Uint8Array): Promise<BIP32.Seed> {
    const obj = new Seed(seed);
    return revocable(obj, (x) => obj.addRevoker(x));
  }

  async toMasterKey(hmacKey?: string | Uint8Array): Promise<BIP32.Node> {
    if (hmacKey !== undefined && typeof hmacKey !== "string" && !(hmacKey instanceof Uint8Array))
      throw new Error("bad hmacKey type");

    // AFAIK all BIP32 implementations use the "Bitcoin seed" string for this derivation, even if they aren't otherwise Bitcoin-related
    hmacKey = hmacKey ?? "Bitcoin seed";
    if (typeof hmacKey === "string") hmacKey = new TextEncoder().encode(hmacKey.normalize("NFKD"));
    const I = safeBufferFrom(bip32crypto.hmacSHA512(safeBufferFrom(hmacKey), this.#seed));
    const IL = I.slice(0, 32);
    const IR = I.slice(32, 64);
    const out = await Node.create(IL, IR);
    this.addRevoker(() => out.revoke?.());
    return out;
  }
}
