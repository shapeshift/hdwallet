import * as SecP256K1 from "../secp256k1";
import { ChainCode } from ".";

export interface SeedInterface {
    toMasterKey(hmacKey?: string | Uint8Array): NodeInterface;
}

export interface NodeInterface extends SecP256K1.ECDSAKeyInterface, Partial<SecP256K1.ECDHKeyInterface> {
    readonly publicKey: SecP256K1.CompressedPoint;
    readonly chainCode: ChainCode;
    derive(index: number): this;
}

function isIndexable(x: unknown): x is Record<string, unknown> {
    return typeof x === "object" || typeof x === "function";
}

export function nodeSupportsECDH<T extends NodeInterface>(x: T): x is T & SecP256K1.ECDHKeyInterface {
    return isIndexable(x) && "ecdh" in x && typeof x.ecdh === "function";
}
