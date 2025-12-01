import * as core from "@shapeshiftoss/hdwallet-core";
import { createBLAKE2b } from "hash-wasm";

import { Isolation } from "../..";

const ED25519_PUBLIC_KEY_SIZE = 32;
const SIGNATURE_SCHEME_FLAG_ED25519 = 0x00;

export class SuiAdapter {
  protected readonly nodeAdapter: Isolation.Adapters.Ed25519;

  constructor(nodeAdapter: Isolation.Adapters.Ed25519) {
    this.nodeAdapter = nodeAdapter;
  }

  /**
   * Get SUI address from BIP32 path
   * Address generation:
   * 1. Get Ed25519 public key (32 bytes)
   * 2. Prepend signature scheme flag (0x00 for Ed25519)
   * 3. Hash with BLAKE2b-256
   * 4. Result is the 32-byte SUI address (as hex string with 0x prefix)
   */
  async getAddress(addressNList: core.BIP32Path): Promise<string> {
    const nodeAdapter = await this.nodeAdapter.derivePath(core.addressNListToHardenedBIP32(addressNList));
    const publicKey = await nodeAdapter.getPublicKey();

    if (publicKey.length !== ED25519_PUBLIC_KEY_SIZE) {
      throw new Error(`Invalid Ed25519 public key size: ${publicKey.length}`);
    }

    // Prepend signature scheme flag byte (0x00 for Ed25519)
    const flaggedPublicKey = new Uint8Array(1 + publicKey.length);
    flaggedPublicKey[0] = SIGNATURE_SCHEME_FLAG_ED25519;
    flaggedPublicKey.set(publicKey, 1);

    // Hash with BLAKE2b-256
    const blake2b = await createBLAKE2b(256);
    blake2b.init();
    blake2b.update(flaggedPublicKey);
    const addressBytes = blake2b.digest("binary");

    // Convert to hex string with 0x prefix
    const addressHex = Array.from(addressBytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    return "0x" + addressHex;
  }

  /**
   * Sign SUI transaction
   * Transaction signing:
   * 1. Receive intent message bytes (already includes intent prefix + tx bytes)
   * 2. Hash with BLAKE2b-256
   * 3. Sign hash with Ed25519 private key
   * 4. Return signature as hex string
   */
  async signTransaction(intentMessageBytes: Uint8Array, addressNList: core.BIP32Path): Promise<string> {
    const nodeAdapter = await this.nodeAdapter.derivePath(core.addressNListToHardenedBIP32(addressNList));

    // Hash intent message with BLAKE2b-256
    const blake2b = await createBLAKE2b(256);
    blake2b.init();
    blake2b.update(intentMessageBytes);
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

export default SuiAdapter;
