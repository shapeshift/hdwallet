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
    const nodeAdapter = await this.nodeAdapter.derivePath(core.addressNListToBIP32(addressNList));

    // Stark Node handles key grinding internally while keeping the private key isolated
    return await nodeAdapter.getPublicKey();
  }

  /**
   * Get Starknet address from BIP32 path
   * For Starknet, we derive the private key and compute the corresponding public key.
   * The address is computed as a contract address using the public key.
   */
  async getAddress(addressNList: core.BIP32Path): Promise<string> {
    const nodeAdapter = await this.nodeAdapter.derivePath(core.addressNListToBIP32(addressNList));

    // Stark Node handles key grinding internally while keeping the private key isolated
    const publicKey = await nodeAdapter.getPublicKey();

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

    // Stark Node handles key grinding and signing internally while keeping the private key isolated
    const signature = await nodeAdapter.node.sign(txHash);

    // Return signature as array of hex strings [r, s]
    return [signature.r, signature.s];
  }
}

export default StarknetAdapter;
