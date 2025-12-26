import ecc from "@bitcoinerlab/secp256k1";
import * as starknet from "@scure/starknet";
import * as bip32crypto from "bip32/src/crypto";

import { Core } from "../../../isolation";
import { ByteArray, checkType, safeBufferFrom, Uint32 } from "../../types";
import { Revocable, revocable } from "./revocable";

export * from "../../core/stark";

/**
 * Stark curve Node for Starknet
 *
 * DERIVATION APPROACH:
 * Uses standard BIP32 secp256k1 derivation (same as Bitcoin/Ethereum) per SLIP-0010,
 * then applies Starknet-specific key grinding and uses STARK curve for final operations.
 *
 * This matches industry standard implementations (Argent, Ledger) which derive using
 * secp256k1 BIP32 math, then apply grinding for Stark operations.
 *
 * STARK CURVE SPECIFICATIONS:
 * - Type: Weierstrass elliptic curve (y² = x³ + ax + b)
 * - Prime field (p): 2^251 + 17×2^192 + 1 = 3618502788666131213697322783095070105623107215331596699973092056135872020481
 * - Curve order (n): 3618502788666131213697322783095070105526743751716087489154079457884512865583
 * - Parameters: a = 1, b = 3141592653589793238462643383279502884197169399375105820974944592307816406665
 * - Bit length: 252 bits (vs 256 for secp256k1)
 * - Generator: (874739451078007766457464989774322083649278607533249481151382481072868806602, 152666792071518830868575557812948353041420400780739481342941381225525861407)
 *
 * KEY GRINDING:
 * Starknet requires "key grinding" to ensure derived private keys fall within the STARK curve order.
 * The grinding algorithm iteratively hashes until finding a valid key: hash(key||i) mod stark_order.
 * See: https://docs.starkware.co/starkex/crypto/key-derivation.html
 *
 * REFERENCES:
 * - STARK Curve: https://docs.starkware.co/starkex/crypto/stark-curve.html
 * - Key Derivation: https://docs.starkware.co/starkex/crypto/key-derivation.html
 * - Community Standard (BIP-44 preferred): https://community.starknet.io/t/account-keys-and-addresses-derivation-standard/1230
 * - Starknet Cryptography: https://docs.starknet.io/architecture/cryptography/
 * - SLIP-0010 (HD wallet standard): https://github.com/satoshilabs/slips/blob/master/slip-0010.md
 * - @scure/starknet (implementation): https://github.com/paulmillr/scure-starknet
 * - Argent reference: https://github.com/argentlabs/argent-starknet-recover/blob/main/keyDerivation.ts
 */
export class Node extends Revocable(class {}) implements Core.Stark.Node {
  readonly #privateKey: Buffer & ByteArray<32>;
  readonly chainCode: Buffer & Core.BIP32.ChainCode;
  readonly explicitPath?: string;

  protected constructor(privateKey: Uint8Array, chainCode: Uint8Array, explicitPath?: string) {
    super();
    // We avoid handing the private key to any non-platform code -- including our type-checking machinery.
    if (privateKey.length !== 32) throw new Error("bad private key length");
    this.#privateKey = safeBufferFrom<undefined>(privateKey) as Buffer & ByteArray<32>;
    this.addRevoker(() => this.#privateKey.fill(0));
    this.chainCode = safeBufferFrom(checkType(Core.BIP32.ChainCode, chainCode)) as Buffer & Core.BIP32.ChainCode;
    this.explicitPath = explicitPath;
  }

  static async create(privateKey: Uint8Array, chainCode: Uint8Array, explicitPath?: string): Promise<Core.Stark.Node> {
    const obj = new Node(privateKey, chainCode, explicitPath);
    return revocable(obj, (x) => obj.addRevoker(x));
  }

  /**
   * Get Stark public key
   * Applies Starknet-specific key grinding before deriving public key on STARK curve
   * Returns zero-padded 64-character hex string (66 chars total with 0x prefix)
   */
  async getPublicKey(): Promise<string> {
    const groundPrivateKey = starknet.grindKey(this.#privateKey);
    const publicKey = starknet.getStarkKey(groundPrivateKey);
    // Ensure proper zero-padding to 64 hex characters per Starknet address spec
    const paddedPublicKey = publicKey.startsWith("0x")
      ? "0x" + publicKey.slice(2).padStart(64, "0")
      : "0x" + publicKey.padStart(64, "0");

    console.log('[HDWALLET_STARK_DEBUG] getPublicKey:', JSON.stringify({
      rawPublicKey: publicKey,
      rawPublicKeyLength: publicKey.length,
      paddedPublicKey,
      paddedPublicKeyLength: paddedPublicKey.length,
    }, null, 2));

    return paddedPublicKey;
  }

  async getChainCode() {
    return this.chainCode;
  }

  /**
   * Sign transaction hash on STARK curve
   * Applies key grinding and returns ECDSA signature with proper padding
   */
  async sign(txHash: string): Promise<{ r: string; s: string }> {
    console.log('[HDWALLET_STARK_DEBUG] sign input txHash:', txHash, 'length:', txHash.length);

    const groundPrivateKey = starknet.grindKey(this.#privateKey);
    const signature = starknet.sign(txHash, groundPrivateKey);

    const result = {
      r: signature.r.toString(16).padStart(64, "0"),
      s: signature.s.toString(16).padStart(64, "0"),
    };

    console.log('[HDWALLET_STARK_DEBUG] sign output:', JSON.stringify({
      rawR: signature.r.toString(16),
      rawRLength: signature.r.toString(16).length,
      rawS: signature.s.toString(16),
      rawSLength: signature.s.toString(16).length,
      paddedR: result.r,
      paddedRLength: result.r.length,
      paddedS: result.s,
      paddedSLength: result.s.length,
    }, null, 2));

    return result;
  }

  /**
   * Derive child key using standard BIP32 secp256k1 derivation
   *
   * NOTE: This uses secp256k1 field arithmetic (ecc.privateAdd) per SLIP-0010,
   * which is the industry standard for Starknet (matches Argent, Ledger implementations).
   * The derived key is then ground for Stark operations in getPublicKey/sign methods.
   */
  async derive(index: Uint32): Promise<this> {
    Uint32.assert(index);

    const serP = Buffer.alloc(37);
    if (index < 0x80000000) {
      // Non-hardened derivation uses public key
      // For Stark, we use secp256k1 public key for BIP32 derivation (industry standard)
      // The grinding + Stark operations happen only in final getPublicKey/sign
      const secp256k1PubKey = ecc.pointFromScalar(this.#privateKey, true);
      if (secp256k1PubKey === null) {
        throw new Error("Failed to generate public key from private key");
      }
      serP.set(secp256k1PubKey, 0);
    } else {
      // Hardened derivation uses private key
      serP.set(this.#privateKey, 1);
    }
    serP.writeUInt32BE(index, 33);

    const I = bip32crypto.hmacSHA512(this.chainCode, serP);
    const IL = I.slice(0, 32);
    const IR = I.slice(32, 64);

    // Use secp256k1 curve arithmetic for derivation (per SLIP-0010 / industry standard)
    const ki = ecc.privateAdd(this.#privateKey, IL);
    if (ki === null) throw new Error("ki is null; this should be cryptographically impossible");

    const out = await Node.create(ki, IR);
    this.addRevoker(() => out.revoke?.());
    return out as this;
  }
}
