import * as SecP256K1 from "../secp256k1";
import { ChainCode } from ".";

export interface SeedInterface {
    toMasterKey(hmacKey?: string | Uint8Array): NodeInterface;
}

export interface NodeInterface extends SecP256K1.ECDSAKeyInterface {
    readonly publicKey: SecP256K1.CompressedPoint;
    readonly chainCode: ChainCode;
    derive(index: number): this;
}
