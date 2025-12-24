import ecc from "@bitcoinerlab/secp256k1";
import * as bip32crypto from "bip32/src/crypto";
import * as starknet from "@scure/starknet";

import { Core } from "../../../isolation";
import { assertType, ByteArray, checkType, safeBufferFrom, Uint32 } from "../../types";
import { Revocable, revocable } from "./revocable";

export * from "../../core/stark";

/**
 * Stark curve Node for Starknet
 *
 * Uses standard BIP32 secp256k1 derivation (same as Bitcoin/Ethereum),
 * but applies Starknet-specific key grinding and uses STARK curve for
 * public key generation and signing operations.
 *
 * This matches industry standard implementations (Argent, Ledger) which
 * derive using secp256k1 BIP32 math, then apply grinding for Stark operations.
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
   */
  async getPublicKey(): Promise<string> {
    const groundPrivateKey = starknet.grindKey(this.#privateKey);
    return starknet.getStarkKey(groundPrivateKey);
  }

  async getChainCode() {
    return this.chainCode;
  }

  /**
   * Sign transaction hash on STARK curve
   * Applies key grinding and returns ECDSA signature with proper padding
   */
  async sign(txHash: string): Promise<{ r: string; s: string }> {
    const groundPrivateKey = starknet.grindKey(this.#privateKey);
    const signature = starknet.sign(txHash, groundPrivateKey);
    return {
      r: signature.r.toString(16).padStart(64, '0'),
      s: signature.s.toString(16).padStart(64, '0'),
    };
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
      // Non-hardened derivation: not supported for Starknet (should always use hardened)
      // But we include for completeness per BIP32 spec
      throw new Error("Starknet derivation requires hardened indices");
    } else {
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
