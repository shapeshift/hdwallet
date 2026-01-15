import * as core from "@shapeshiftoss/hdwallet-core";
import { createBLAKE2b } from "hash-wasm";

import { Isolation } from "../..";

const ED25519_PUBLIC_KEY_SIZE = 32;

export class AptosAdapter {
  protected readonly nodeAdapter: Isolation.Adapters.Ed25519;

  constructor(nodeAdapter: Isolation.Adapters.Ed25519) {
    this.nodeAdapter = nodeAdapter;
  }

  /**
   * Get Aptos address from BIP32 path
   * Address generation:
   * 1. Get Ed25519 public key (32 bytes)
   * 2. Hash with BLAKE2b-256
   * 3. Result is the 32-byte Aptos address (as hex string with 0x prefix)
   */
  async getAddress(addressNList: core.BIP32Path): Promise<string> {
    const nodeAdapter = await this.nodeAdapter.derivePath(core.addressNListToHardenedBIP32(addressNList));
    const publicKey = await nodeAdapter.getPublicKey();

    if (publicKey.length !== ED25519_PUBLIC_KEY_SIZE) {
      throw new Error(`Invalid Ed25519 public key size: ${publicKey.length}`);
    }

    // Hash public key with BLAKE2b-256
    const blake2b = await createBLAKE2b(256);
    blake2b.init();
    blake2b.update(publicKey);
    const addressBytes = blake2b.digest("binary");

    // Convert to hex string with 0x prefix
    const addressHex = Array.from(addressBytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    return "0x" + addressHex;
  }

  /**
   * Sign Aptos transaction
   * Transaction signing:
   * 1. Receive transaction bytes
   * 2. Hash with BLAKE2b-256
   * 3. Sign hash with Ed25519 private key
   * 4. Return signature as hex string
   */
  async signTransaction(transactionBytes: Uint8Array, addressNList: core.BIP32Path): Promise<string> {
    const nodeAdapter = await this.nodeAdapter.derivePath(core.addressNListToHardenedBIP32(addressNList));

    // Hash transaction with BLAKE2b-256
    const blake2b = await createBLAKE2b(256);
    blake2b.init();
    blake2b.update(transactionBytes);
    const messageHash = blake2b.digest("binary");

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
   */
  async getPublicKey(addressNList: core.BIP32Path): Promise<string> {
    const nodeAdapter = await this.nodeAdapter.derivePath(core.addressNListToHardenedBIP32(addressNList));
    const publicKey = await nodeAdapter.getPublicKey();

    // Convert to hex string
    const publicKeyHex = Array.from(publicKey)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    return publicKeyHex;
  }
}

export default AptosAdapter;
