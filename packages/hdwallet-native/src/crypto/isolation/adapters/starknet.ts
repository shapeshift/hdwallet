/* eslint-disable no-console */
import * as core from "@shapeshiftoss/hdwallet-core";
import { CallData, hash } from "starknet";

import { Isolation } from "../..";

/**
 * Starknet adapter using Stark curve engine
 *
 * Uses dedicated Stark engine with STARK curve operations instead of
 * polluting the generic BIP32 secp256k1 engine with chain-specific code.
 */
export class StarknetAdapter {
  protected readonly nodeAdapter: Isolation.Adapters.Stark;

  // OpenZeppelin account v0.15.0-rc.0 class hash (used by most wallets)
  private readonly OZ_ACCOUNT_CLASS_HASH = "0x05b4b537eaa2399e3aa99c4e2e0208ebd6c71bc1467938cd52c798c601e43564";

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
   * Computes the counterfactual contract address using OpenZeppelin account implementation
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

    // Compute actual contract address using OpenZeppelin account contract
    // This matches what the web is doing for deployment
    const constructorCalldata = CallData.compile({ publicKey });
    const contractAddress = hash.calculateContractAddressFromHash(
      publicKey,                    // salt (use public key as salt)
      this.OZ_ACCOUNT_CLASS_HASH,   // class hash
      constructorCalldata,          // constructor calldata
      0                             // deployer address (0 for counterfactual)
    );
    console.log("[StarknetAdapter.getAddress] Contract address:", contractAddress);

    return contractAddress;
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
