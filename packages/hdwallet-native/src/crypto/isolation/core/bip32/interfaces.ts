import * as SecP256K1 from "../secp256k1";
import { ChainCode } from ".";

export interface Seed {
    toMasterKey(hmacKey?: string | Uint8Array): Node;
}

export interface Node extends SecP256K1.ECDSAKey, Partial<SecP256K1.ECDHKey> {
    readonly publicKey: SecP256K1.CompressedPoint;
    readonly chainCode: ChainCode;
    derive(index: number): this;
}

function isIndexable(x: unknown): x is Record<string, unknown> {
    return typeof x === "object" || typeof x === "function";
}

export function nodeSupportsECDH<T extends Node>(x: T): x is T & SecP256K1.ECDHKey {
    return isIndexable(x) && "ecdh" in x && typeof x.ecdh === "function";
}
