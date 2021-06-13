import { ECPairInterface, Network, SignerAsync } from "@bithighlander/bitcoin-cash-js-lib";
import { bitcoin } from "@bithighlander/bitcoin-cash-js-lib/src/networks"
import { SecP256K1, IsolationError } from "../core"

const DigestSourceHint = Symbol.for("hdwallet_isolation_digest_source_hint");

export type ECPairInterfaceAsync = Omit<ECPairInterface, "sign"> & Pick<SignerAsync, "sign">;

export class ECPairAdapter implements SecP256K1.ECDSAKeyInterface, SignerAsync, ECPairInterfaceAsync {
    protected _isolatedKey: SecP256K1.ECDSAKeyInterface;
    readonly _network: Network | undefined;
    compressed: boolean = false;
    lowR: boolean = false;

    constructor(isolatedKey: SecP256K1.ECDSAKeyInterface, network?: Network) {
        this._isolatedKey = isolatedKey;
        this._network = network;
    }

    get network() {
        return this._network ?? bitcoin;
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
        const hint = (DigestSourceHint in hash ? (hash as {[DigestSourceHint]?: {preimage: Buffer, algorithm: string}})[DigestSourceHint] : undefined);
        const msg = Object.assign(Buffer.from(hash), hint ?? {});
        
        lowR = lowR ?? this.lowR;
        const sig = (!lowR ? await this._isolatedKey.ecdsaSign(msg) : await SecP256K1.Signature.signCanonically(this._isolatedKey, hash));
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
