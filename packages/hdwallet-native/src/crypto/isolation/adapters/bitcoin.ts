import ecc from "@bitcoinerlab/secp256k1";
import type { Network, networks, SignerAsync } from "@shapeshiftoss/bitcoinjs-lib";
import { initEccLib } from "@shapeshiftoss/bitcoinjs-lib";
import { ECPairInterface } from "ecpair";
import PLazy from "p-lazy";

import { IsolationError, SecP256K1 } from "../core";
import { assertType, ByteArray } from "../types";

export type ECPairInterfaceAsync = Omit<ECPairInterface, "sign" | "tweak" | "verifySchnorr" | "signSchnorr"> &
  Pick<SignerAsync, "sign">;

let networksInstance: typeof networks | undefined;
const networksReady = PLazy.from(async () => {
  networksInstance = (await import("@shapeshiftoss/bitcoinjs-lib")).networks;
});

export class ECPairAdapter implements SignerAsync, ECPairInterfaceAsync {
  protected readonly _isolatedKey: SecP256K1.ECDSAKey;
  readonly _publicKey: SecP256K1.CurvePoint;
  readonly _network: Network | undefined;
  compressed = false;
  lowR = false;

  protected constructor(isolatedKey: SecP256K1.ECDSAKey, publicKey: SecP256K1.CurvePoint, network?: Network) {
    this._isolatedKey = isolatedKey;
    this._publicKey = publicKey;
    this._network = network;
    // instantiation of ecc lib required for taproot sends https://github.com/bitcoinjs/bitcoinjs-lib/issues/1889#issuecomment-1443792692
    initEccLib(ecc);
  }

  /**
   * If you're inheriting from this class, be sure to call `await ECPairAdapter.prepare()` in your `create()` overload.
   */
  protected static async prepare() {
    await networksReady;
  }

  static async create(isolatedKey: SecP256K1.ECDSAKey, network?: Network): Promise<ECPairAdapter> {
    await this.prepare();
    return new ECPairAdapter(isolatedKey, await isolatedKey.getPublicKey(), network);
  }

  get network() {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return this._network ?? networksInstance!.bitcoin;
  }

  get ecdsaSign() {
    return this._isolatedKey.ecdsaSign.bind(this._isolatedKey);
  }

  get ecdh() {
    const isolatedKey = this._isolatedKey as object as Record<string, unknown>;
    if (!("ecdh" in isolatedKey && typeof isolatedKey.ecdh === "function")) return undefined;
    return isolatedKey.ecdh.bind(isolatedKey);
  }

  get ecdhRaw() {
    const isolatedKey = this._isolatedKey as object as Record<string, unknown>;
    if (!("ecdhRaw" in isolatedKey && typeof isolatedKey.ecdhRaw === "function")) return undefined;
    return isolatedKey.ecdhRaw.bind(isolatedKey);
  }

  async sign(hash: Uint8Array, lowR?: boolean): Promise<Buffer> {
    assertType(ByteArray(32), hash);
    lowR = lowR ?? this.lowR;
    const sig = !lowR
      ? await this._isolatedKey.ecdsaSign(null, hash)
      : await SecP256K1.Signature.signCanonically(this._isolatedKey, null, hash);
    return Buffer.from(sig);
  }
  get publicKey() {
    return this.getPublicKey();
  }
  getPublicKey() {
    const publicKey = this._publicKey;
    const key = this.compressed
      ? SecP256K1.CompressedPoint.from(publicKey)
      : SecP256K1.UncompressedPoint.from(publicKey);
    return Buffer.from(key) as Buffer & SecP256K1.CurvePoint;
  }

  toWIF(): never {
    throw new IsolationError("WIF");
  }
  verify(hash: Uint8Array, signature: Uint8Array) {
    SecP256K1.Signature.assert(signature);
    return SecP256K1.Signature.verify(signature, null, hash, this._publicKey);
  }
}

export default ECPairAdapter;
