/* eslint-disable no-console */
import * as core from "@shapeshiftoss/hdwallet-core";

import { Isolation } from "../..";

/**
 * Starknet adapter using Stark curve engine
 *
 * Uses dedicated Stark engine with STARK curve operations instead of
 * polluting the generic BIP32 secp256k1 engine with chain-specific code.
 */
export class StarknetAdapter {
  protected readonly nodeAdapter: Isolation.Adapters.Stark;

  constructor(nodeAdapter: Isolation.Adapters.Stark) {
    this.nodeAdapter = nodeAdapter;
  }

  /**
   * Get Starknet public key from BIP32 path
   */
  async getPublicKey(addressNList: core.BIP32Path): Promise<string> {
    console.log("[StarknetAdapter.getPublicKey] Input:", JSON.stringify({ addressNList }));
    const bip32Path = core.addressNListToBIP32(addressNList);
    console.log("[StarknetAdapter.getPublicKey] BIP32 path:", bip32Path);

    const nodeAdapter = await this.nodeAdapter.derivePath(bip32Path);
    console.log("[StarknetAdapter.getPublicKey] Node adapter derived");

    // Stark Node handles key grinding internally while keeping the private key isolated
    const publicKey = await nodeAdapter.getPublicKey();
    console.log("[StarknetAdapter.getPublicKey] Public key:", publicKey);

    return publicKey;
  }

  /**
   * Get Starknet address from BIP32 path
   * For Starknet, we derive the private key and compute the corresponding public key.
   * The address is computed as a contract address using the public key.
   */
  async getAddress(addressNList: core.BIP32Path): Promise<string> {
    console.log("[StarknetAdapter.getAddress] Input:", JSON.stringify({ addressNList }));
    const bip32Path = core.addressNListToBIP32(addressNList);
    console.log("[StarknetAdapter.getAddress] BIP32 path:", bip32Path);

    const nodeAdapter = await this.nodeAdapter.derivePath(bip32Path);
    console.log("[StarknetAdapter.getAddress] Node adapter derived");

    // Stark Node handles key grinding internally while keeping the private key isolated
    const publicKey = await nodeAdapter.getPublicKey();
    console.log("[StarknetAdapter.getAddress] Public key:", publicKey);

    // For now, return the public key as the address identifier
    // In practice, the actual address depends on the account contract deployment
    // This will be the "pre-computed" or "counterfactual" address
    console.log("[StarknetAdapter.getAddress] Returning public key as address (TODO: compute actual contract address)");
    return publicKey;
  }

  /**
   * Sign Starknet transaction
   * Starknet uses ECDSA on the STARK curve for transaction signing
   */
  async signTransaction(txHash: string, addressNList: core.BIP32Path): Promise<string[]> {
    console.log("[StarknetAdapter.signTransaction] Input:", JSON.stringify({ txHash, addressNList }));
    const bip32Path = core.addressNListToBIP32(addressNList);
    console.log("[StarknetAdapter.signTransaction] BIP32 path:", bip32Path);

    const nodeAdapter = await this.nodeAdapter.derivePath(bip32Path);
    console.log("[StarknetAdapter.signTransaction] Node adapter derived");

    // Stark Node handles key grinding and signing internally while keeping the private key isolated
    const signature = await nodeAdapter.node.sign(txHash);
    console.log("[StarknetAdapter.signTransaction] Signature:", JSON.stringify(signature));

    // Return signature as array of hex strings [r, s]
    const result = [signature.r, signature.s];
    console.log("[StarknetAdapter.signTransaction] Result:", JSON.stringify(result));
    return result;
  }
}

export default StarknetAdapter;
