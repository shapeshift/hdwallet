import { Revocable } from "..";
import { ChainCode } from "../bip32";

/**
 * Stark curve Node interface for Starknet
 *
 * Similar to BIP32.Node but uses STARK curve for public key and signing operations.
 * Derivation follows standard BIP32 with secp256k1 arithmetic (per industry standard),
 * then applies Starknet-specific key grinding for final operations.
 */
export interface Node extends Partial<Revocable> {
  readonly explicitPath?: string;
  getPublicKey(): Promise<string>;
  getChainCode(): Promise<ChainCode>;
  derive(index: number): Promise<this>;
  sign(txHash: string): Promise<{ r: string; s: string }>;
}
