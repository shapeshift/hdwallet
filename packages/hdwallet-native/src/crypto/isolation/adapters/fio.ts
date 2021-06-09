/// <reference types="@fioprotocol/fiojs/dist/chain-jssig" />

import { ExternalPrivateKey as FIOExternalPrivateKey } from "@fioprotocol/fiojs/dist/chain-jssig";
import { Signature as FIOSignature } from "@fioprotocol/fiojs/dist/ecc";
import bs58 from "bs58"

import { SecP256K1 } from "..";
import * as Digest from "../core/digest";
import { checkType } from "../types";

type IsolatedKey = SecP256K1.ECDSAKeyInterface & SecP256K1.ECDHKeyInterface;
export class ExternalSignerAdapter implements FIOExternalPrivateKey {
    _isolatedKey: IsolatedKey;
    constructor(isolatedKey: IsolatedKey) {
        this._isolatedKey = isolatedKey;
    }
    get publicKey(): string {
        const raw = SecP256K1.CompressedPoint.from(this._isolatedKey.publicKey)
        const FIO_PUBLIC_PREFIX = "FIO";
        const checksum = Digest.Algorithms["ripemd160"](raw).slice(0, 4);
        return `FIO${bs58.encode(Buffer.concat([raw, checksum]))}`;
    }
    sign(signBuf: Uint8Array): string {
        const signBufHash = Digest.Algorithms["sha256"](signBuf);
        const sig = SecP256K1.RecoverableSignature.fromSignature(this._isolatedKey.ecdsaSign(signBufHash), signBufHash, this._isolatedKey.publicKey);
        const fioSigBuf = Buffer.concat([Buffer.from([sig.recoveryParam + 4 + 27]), SecP256K1.RecoverableSignature.r(sig), SecP256K1.RecoverableSignature.s(sig)]);
        return FIOSignature.fromBuffer(fioSigBuf).toString();
    }
    getSharedSecret(publicKey: any): Buffer {
        return Buffer.from(Digest.Algorithms["sha512"](this._isolatedKey.ecdh(checkType(SecP256K1.CurvePoint, publicKey.toBuffer()))));
    }
}

export default ExternalSignerAdapter;
