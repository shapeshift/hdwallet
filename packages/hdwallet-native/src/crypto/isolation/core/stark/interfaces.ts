import { Revocable } from "..";
import { ChainCode } from "../bip32";

/**
 * Stark curve Node interface for Starknet
 *
 * OVERVIEW:
 * Implements hierarchical deterministic key derivation for Starknet using the STARK curve.
 * Uses standard BIP32 secp256k1 derivation math (per SLIP-0010 and industry standard),
 * then applies Starknet-specific key grinding for public key generation and signing.
 *
 * STARK CURVE:
 * - Weierstrass curve: y² = x³ + ax + b (mod p)
 * - Prime field: p = 2^251 + 17×2^192 + 1 (251-bit, not 256-bit like secp256k1)
 * - Parameters: a = 1, b = π
 * - Different from secp256k1, requires separate implementation
 * - Spec: https://docs.starkware.co/starkex/crypto/stark-curve.html
 *
 * KEY METHODS:
 * - getPublicKey(): Returns Stark public key (after grinding) as hex string
 * - sign(): ECDSA signature on STARK curve, returns {r, s} with 64-char hex padding
 * - derive(): BIP32 child key derivation using secp256k1 field arithmetic
 *
 * REFERENCES:
 * - STARK Curve: https://docs.starkware.co/starkex/crypto/stark-curve.html
 * - Key Grinding: https://docs.starkware.co/starkex/crypto/key-derivation.html
 * - Starknet Cryptography: https://docs.starknet.io/architecture/cryptography/
 * - SLIP-0010: https://github.com/satoshilabs/slips/blob/master/slip-0010.md
 */
export interface Node extends Partial<Revocable> {
  readonly explicitPath?: string;
  /** Get Stark public key (applies key grinding, returns hex string) */
  getPublicKey(): Promise<string>;
  /** Get BIP32 chain code for derivation */
  getChainCode(): Promise<ChainCode>;
  /** Derive child key using BIP32 secp256k1 math (per industry standard) */
  derive(index: number): Promise<this>;
  /** Sign transaction hash on STARK curve (returns padded 64-char hex r,s) */
  sign(txHash: string): Promise<{ r: string; s: string }>;
}
