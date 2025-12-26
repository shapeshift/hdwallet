import * as core from "@shapeshiftoss/hdwallet-core";

import { Isolation } from "../..";

const ED25519_PUBLIC_KEY_SIZE = 32;

export class NearAdapter {
  protected readonly nodeAdapter: Isolation.Adapters.Ed25519;

  constructor(nodeAdapter: Isolation.Adapters.Ed25519) {
    this.nodeAdapter = nodeAdapter;
  }

  /**
   * Get NEAR implicit account address from BIP32 path
   *
   * NEAR implicit accounts are derived directly from Ed25519 public keys:
   * - Account ID = lowercase hex encoding of the 32-byte Ed25519 public key
   * - Result is a 64 character hex string
   *
   * @see https://docs.near.org/integrations/implicit-accounts
   */
  async getAddress(addressNList: core.BIP32Path): Promise<string> {
    const nodeAdapter = await this.nodeAdapter.derivePath(core.addressNListToHardenedBIP32(addressNList));
    const publicKey = await nodeAdapter.getPublicKey();

    if (publicKey.length !== ED25519_PUBLIC_KEY_SIZE) {
      throw new Error(`Invalid Ed25519 public key size: ${publicKey.length}`);
    }

    // NEAR implicit account = lowercase hex of the 32-byte Ed25519 public key
    const addressHex = Array.from(publicKey)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    return addressHex;
  }

  /**
   * Sign NEAR transaction
   *
   * NEAR transaction signing process:
   * 1. Receive Borsh-serialized transaction bytes
   * 2. Hash with SHA-256
   * 3. Sign hash with Ed25519 private key
   * 4. Return signature as hex string
   *
   * Note: The caller is responsible for Borsh serialization of the transaction
   */
  async signTransaction(txBytes: Uint8Array, addressNList: core.BIP32Path): Promise<string> {
    const nodeAdapter = await this.nodeAdapter.derivePath(core.addressNListToHardenedBIP32(addressNList));

    // NEAR signs the SHA-256 hash of the Borsh-serialized transaction
    // The Ed25519 implementation will handle the actual signing
    // Note: Ed25519 in NEAR signs the raw SHA-256 hash (32 bytes)
    const crypto = await import("crypto");
    const messageHash = crypto.createHash("sha256").update(txBytes).digest();

    // Sign the hash with Ed25519
    const signature = await nodeAdapter.node.sign(messageHash);

    // Convert signature to hex string
    const signatureHex = Array.from(signature)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    return signatureHex;
  }

  /**
   * Get public key for address verification
   * Returns the public key in NEAR's ed25519 format: "ed25519:<base58-encoded-key>"
   */
  async getPublicKey(addressNList: core.BIP32Path): Promise<string> {
    const nodeAdapter = await this.nodeAdapter.derivePath(core.addressNListToHardenedBIP32(addressNList));
    const publicKey = await nodeAdapter.getPublicKey();

    // Convert to hex string (we'll convert to base58 in the caller if needed)
    const publicKeyHex = Array.from(publicKey)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    return publicKeyHex;
  }
}

export default NearAdapter;
