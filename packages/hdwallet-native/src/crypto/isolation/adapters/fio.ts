import { ExternalPrivateKey as FIOExternalPrivateKey } from "@shapeshiftoss/fiojs";
import * as core from "@shapeshiftoss/hdwallet-core"
import bs58 from "bs58"

import { SecP256K1 } from "../core";
import * as Digest from "../core/digest";
import { checkType } from "../types";

function bs58FioEncode(raw: Uint8Array, keyType: string = ""): string {
    const typeBuf = Buffer.from(keyType, "utf8");
    const checksum = Digest.Algorithms["ripemd160"](core.compatibleBufferConcat([raw, typeBuf])).slice(0, 4);
    return bs58.encode(core.compatibleBufferConcat([raw, checksum]));
}

type IsolatedKey = SecP256K1.ECDSAKey & SecP256K1.ECDHKey;
export class ExternalSignerAdapter implements FIOExternalPrivateKey {
    _isolatedKey: IsolatedKey;
    constructor(isolatedKey: IsolatedKey) {
        this._isolatedKey = isolatedKey;
    }
    get publicKey(): string {
        const raw = SecP256K1.CompressedPoint.from(this._isolatedKey.publicKey)
        return `FIO${bs58FioEncode(raw)}`;
    }
    async sign(signBuf: Uint8Array): Promise<string> {
        const signBufHash = Digest.Algorithms["sha256"](signBuf);
        const sig = await SecP256K1.RecoverableSignature.signCanonically(this._isolatedKey, signBufHash);
        const fioSigBuf = core.compatibleBufferConcat([Buffer.from([sig.recoveryParam + 4 + 27]), SecP256K1.RecoverableSignature.r(sig), SecP256K1.RecoverableSignature.s(sig)]);
        return `SIG_K1_${bs58FioEncode(fioSigBuf, "K1")}`;
    }
    async getSharedSecret(publicKey: any): Promise<Buffer> {
        return Buffer.from(Digest.Algorithms["sha512"](await this._isolatedKey.ecdh(checkType(SecP256K1.CurvePoint, publicKey.toBuffer()))));
    }
}

export default ExternalSignerAdapter;
