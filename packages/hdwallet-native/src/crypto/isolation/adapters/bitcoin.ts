import { ECPairInterface, Network, SignerAsync, crypto as bcrypto, networks } from "@shapeshiftoss/bitcoinjs-lib";
import { SecP256K1, IsolationError } from "../core"
import { assertType, ByteArray } from "../types";

export type ECPairInterfaceAsync = Omit<ECPairInterface, "sign"> & Pick<SignerAsync, "sign">;

export class ECPairAdapter implements SecP256K1.ECDSAKey, SignerAsync, ECPairInterfaceAsync {
    protected readonly _isolatedKey: SecP256K1.ECDSAKey;
    readonly _publicKey: SecP256K1.CurvePoint;
    readonly _network: Network | undefined;
    compressed: boolean = false;
    lowR: boolean = false;

    protected constructor(isolatedKey: SecP256K1.ECDSAKey, publicKey: SecP256K1.CurvePoint, network?: Network) {
        this._isolatedKey = isolatedKey;
        this._publicKey = publicKey;
        this._network = network;
    }

    static async create(isolatedKey: SecP256K1.ECDSAKey, network?: Network): Promise<ECPairAdapter> {
        return new ECPairAdapter(isolatedKey, await isolatedKey.getPublicKey(), network);
    }

    get network() {
        return this._network ?? networks.bitcoin;
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

    async sign(hash: bcrypto.NonDigest | bcrypto.Digest<"hash256">, lowR?: boolean): Promise<Buffer> {
        assertType(ByteArray(), hash);

        lowR = lowR ?? this.lowR;
        const sig = await(async () => {
          if (!hash.algorithm) {
            assertType(ByteArray(32), hash);
            return !lowR
              ? await this._isolatedKey.ecdsaSign(null, hash)
              : await SecP256K1.Signature.signCanonically(this._isolatedKey, null, hash);
          } else {
            return !lowR
              ? await this._isolatedKey.ecdsaSign(hash.algorithm, hash.preimage)
              : await SecP256K1.Signature.signCanonically(this._isolatedKey, hash.algorithm, hash.preimage);
          }
        })();
        return Buffer.from(sig);
    }
    get publicKey() { return this.getPublicKey(); }
    getPublicKey() {
        const publicKey = this._publicKey;
        const key = (this.compressed ? SecP256K1.CompressedPoint.from(publicKey) : SecP256K1.UncompressedPoint.from(publicKey));
        return Buffer.from(key) as Buffer & SecP256K1.CurvePoint;
    }

    toWIF(): never { throw new IsolationError("WIF"); }
    verify(hash: Uint8Array, signature: Uint8Array) {
        SecP256K1.Signature.assert(signature);
        return SecP256K1.Signature.verify(signature, null, hash, this._publicKey);
    }
}

export default ECPairAdapter;
