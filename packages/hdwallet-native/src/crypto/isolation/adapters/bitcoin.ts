import { ECPairInterface, Network, Signer } from "@bithighlander/bitcoin-cash-js-lib";
import { SecP256K1, IsolationError } from "../core"
import { CurvePoint } from "../core/secp256k1";

const DigestSourceHint = Symbol.for("hdwallet_isolation_digest_source_hint");

export class ECPairAdapter implements SecP256K1.ECDSAKeyInterface, Signer, ECPairInterface {
    protected _isolatedKey: SecP256K1.ECDSAKeyInterface;
    readonly network: Network;
    compressed: boolean = false;
    lowR: boolean = false;

    constructor(isolatedKey: SecP256K1.ECDSAKeyInterface, network?: Network) {
        this._isolatedKey = isolatedKey;
        this.network = network;
    }

    get ecdsaSign() {
        return this._isolatedKey.ecdsaSign.bind(this._isolatedKey);
    }

    get ecdh() {
        const out = this._isolatedKey["ecdh"];
        return (typeof out === "function" ? out.bind(this._isolatedKey) : undefined);
    }

    get ecdhRaw() {
        const out = this._isolatedKey["ecdhRaw"];
        return (typeof out === "function" ? out.bind(this._isolatedKey) : undefined);
    }

    sign(hash: Uint8Array, lowR?: boolean): Buffer {
        const hint: {preimage: Buffer, algorithm: string} = hash[DigestSourceHint];
        const msg = Object.assign(Buffer.from(hash), hint ?? {});
        
        lowR = lowR ?? this.lowR;
        const sig = (!lowR ? this._isolatedKey.ecdsaSign(msg) : SecP256K1.Signature.signCanonically(this._isolatedKey, hash));
        return Buffer.from(sig);
    }
    get publicKey() { return this.getPublicKey(); }
    getPublicKey() {
        const publicKey = this._isolatedKey.publicKey;
        const key = (this.compressed ? SecP256K1.CompressedPoint.from(publicKey) : SecP256K1.UncompressedPoint.from(publicKey));
        return Buffer.from(key) as Buffer & CurvePoint;
    }

    toWIF(): never { throw new IsolationError("WIF"); }
    verify(hash: Uint8Array, signature: Uint8Array) {
        SecP256K1.Signature.assert(signature);
        return SecP256K1.Signature.verify(signature, hash, this._isolatedKey.publicKey);
    }
}

export default ECPairAdapter;
