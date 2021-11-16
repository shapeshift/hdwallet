import * as core from "@shapeshiftoss/hdwallet-core";

import * as SecP256K1 from "../secp256k1";
import { ChainCode } from ".";
import { Revocable } from "..";

export interface Seed extends Partial<Revocable> {
    toMasterKey(hmacKey?: string | Uint8Array): Promise<Node>;
}

export interface Node extends Partial<Revocable>, SecP256K1.ECDSAKey, Partial<SecP256K1.ECDHKey> {
    getPublicKey(): SecP256K1.CompressedPoint | Promise<SecP256K1.CompressedPoint>;
    getChainCode(): ChainCode | Promise<ChainCode>;
    derive(index: number): Promise<this>;
}

export function nodeSupportsECDH<T extends Node>(x: T): x is T & SecP256K1.ECDHKey {
    return core.isIndexable(x) && "ecdh" in x && typeof x.ecdh === "function";
}
