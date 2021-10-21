import { ECPairInterface, Network, SignerAsync, crypto as bcrypto, networks } from "@shapeshiftoss/bitcoinjs-lib";
import { SecP256K1, IsolationError } from "../core"

export type ECPairInterfaceAsync = Omit<ECPairInterface, "sign"> & Pick<SignerAsync, "sign">;

export class ECPairAdapter implements SecP256K1.ECDSAKey, SignerAsync, ECPairInterfaceAsync {
    protected _isolatedKey: SecP256K1.ECDSAKey;
    readonly _network: Network | undefined;
    compressed: boolean = false;
    lowR: boolean = false;

    constructor(isolatedKey: SecP256K1.ECDSAKey, network?: Network) {
        this._isolatedKey = isolatedKey;
        this._network = network;
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
        lowR = lowR ?? this.lowR;
        const sig = (!lowR ? await this._isolatedKey.ecdsaSign(hash) : await SecP256K1.Signature.signCanonically(this._isolatedKey, hash));
        return Buffer.from(sig);
    }
    get publicKey() { return this.getPublicKey(); }
    getPublicKey() {
        const publicKey = this._isolatedKey.publicKey;
        const key = (this.compressed ? SecP256K1.CompressedPoint.from(publicKey) : SecP256K1.UncompressedPoint.from(publicKey));
        return Buffer.from(key) as Buffer & SecP256K1.CurvePoint;
    }

    toWIF(): never { throw new IsolationError("WIF"); }
    verify(hash: Uint8Array, signature: Uint8Array) {
        SecP256K1.Signature.assert(signature);
        return SecP256K1.Signature.verify(signature, hash, this._isolatedKey.publicKey);
    }
}

export default ECPairAdapter;
