import * as core from "@shapeshiftoss/hdwallet-core";

import { Isolation } from "../..";

export class StarknetAdapter {
  protected readonly nodeAdapter: Isolation.Adapters.BIP32;

  constructor(nodeAdapter: Isolation.Adapters.BIP32) {
    this.nodeAdapter = nodeAdapter;
  }

  /**
   * Get Starknet public key from BIP32 path
   */
  async getPublicKey(addressNList: core.BIP32Path): Promise<string> {
    const nodeAdapter = await this.nodeAdapter.derivePath(core.addressNListToBIP32(addressNList));

    // Use the node's Starknet-specific method to get the public key
    // The node handles key grinding internally while keeping the private key isolated
    const publicKey = await nodeAdapter.node.starknetGetPublicKey?.();
    if (!publicKey) throw new Error("Starknet methods not available on node");

    return publicKey;
  }

  /**
   * Get Starknet address from BIP32 path
   * For Starknet, we derive the private key and compute the corresponding public key.
   * The address is computed as a contract address using the public key.
   */
  async getAddress(addressNList: core.BIP32Path): Promise<string> {
    const nodeAdapter = await this.nodeAdapter.derivePath(core.addressNListToBIP32(addressNList));

    // Use the node's Starknet-specific method to get the public key
    // The node handles key grinding internally while keeping the private key isolated
    const publicKey = await nodeAdapter.node.starknetGetPublicKey?.();
    if (!publicKey) throw new Error("Starknet methods not available on node");

    // For now, return the public key as the address identifier
    // In practice, the actual address depends on the account contract deployment
    // This will be the "pre-computed" or "counterfactual" address
    return publicKey;
  }

  /**
   * Sign Starknet transaction
   * Starknet uses ECDSA on the STARK curve for transaction signing
   */
  async signTransaction(txHash: string, addressNList: core.BIP32Path): Promise<string[]> {
    const nodeAdapter = await this.nodeAdapter.derivePath(core.addressNListToBIP32(addressNList));

    // Use the node's Starknet-specific signing method
    // The node handles key grinding and signing internally while keeping the private key isolated
    const signature = await nodeAdapter.node.starknetSign?.(txHash);
    if (!signature) throw new Error("Starknet methods not available on node");

    // Return signature as array of hex strings [r, s]
    return [signature.r, signature.s];
  }
}

export default StarknetAdapter;
