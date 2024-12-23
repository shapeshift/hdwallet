import * as core from "@shapeshiftoss/hdwallet-core";

import { Revocable } from "..";
import { Ed25519Node } from "../ed25519";
import * as SecP256K1 from "../secp256k1";
import { ChainCode } from ".";

export interface Seed extends Partial<Revocable> {
  toMasterKey(hmacKey?: string | Uint8Array): Promise<Node>;
  toEd25519MasterKey(): Promise<Ed25519Node>;
}

export interface Node extends Partial<Revocable>, SecP256K1.ECDSAKey, Partial<SecP256K1.ECDHKey> {
  readonly explicitPath?: string;
  getPublicKey(): Promise<SecP256K1.CompressedPoint>;
  getChainCode(): Promise<ChainCode>;
  derive(index: number): Promise<this>;
}

export function nodeSupportsECDH<T extends Node>(x: T): x is T & SecP256K1.ECDHKey {
  return core.isIndexable(x) && "ecdh" in x && typeof x.ecdh === "function";
}
