import * as core from "@shapeshiftoss/hdwallet-core";
import { CallData, hash } from "starknet";

import { Isolation } from "../..";

/**
 * Starknet adapter using Stark curve engine
 *
 * Uses dedicated Stark engine with STARK curve operations instead of
 * polluting the generic BIP32 secp256k1 engine with chain-specific code.
 *
 * ACCOUNT ABSTRACTION:
 * All Starknet accounts are smart contracts (no EOAs). The account address is computed from:
 * - Account contract class hash (OpenZeppelin, Argent, Braavos implementations)
 * - Constructor calldata (including public key)
 * - Salt (typically the public key)
 * - Deployer address (0 for counterfactual deployment)
 *
 * DERIVATION PATH:
 * Uses BIP-44 format: m/44'/9004'/accountIdx'/0/0
 * - SLIP-044 coin type: 9004 (Starknet)
 * - Community consensus: BIP-44 preferred over EIP-2645
 * - See: https://community.starknet.io/t/account-keys-and-addresses-derivation-standard/1230
 *
 * REFERENCES:
 * - Starknet Account Architecture: https://docs.starknet.io/architecture/accounts/
 * - Account Abstraction Part I: https://medium.com/starknet-edu/account-abstraction-on-starknet-part-i-2ff84c6a3c30
 * - Account Abstraction Part II: https://medium.com/starknet-edu/account-abstraction-on-starknet-part-ii-24d52874e0bd
 * - Account Creation Guide: https://starknetjs.com/docs/guides/create_account/
 * - OpenZeppelin Accounts: https://docs.openzeppelin.com/contracts-cairo/0.14.0/accounts
 * - SLIP-044 Registry: https://github.com/satoshilabs/slips/blob/master/slip-0044.md
 */
export class StarknetAdapter {
  protected readonly nodeAdapter: Isolation.Adapters.Stark;

  // OpenZeppelin account v0.15.0-rc.0 class hash (used by most wallets)
  // See: https://docs.openzeppelin.com/contracts-cairo/0.14.0/accounts
  private readonly OZ_ACCOUNT_CLASS_HASH = "0x05b4b537eaa2399e3aa99c4e2e0208ebd6c71bc1467938cd52c798c601e43564";

  constructor(nodeAdapter: Isolation.Adapters.Stark) {
    this.nodeAdapter = nodeAdapter;
  }

  /**
   * Get Starknet public key from BIP32 path
   */
  async getPublicKey(addressNList: core.BIP32Path): Promise<string> {
    const bip32Path = core.addressNListToBIP32(addressNList);
    const nodeAdapter = await this.nodeAdapter.derivePath(bip32Path);
    const publicKey = await nodeAdapter.getPublicKey();
    return publicKey;
  }

  /**
   * Get Starknet address from BIP32 path
   * Computes the counterfactual contract address using OpenZeppelin account implementation
   */
  async getAddress(addressNList: core.BIP32Path): Promise<string> {
    const bip32Path = core.addressNListToBIP32(addressNList);
    const nodeAdapter = await this.nodeAdapter.derivePath(bip32Path);
    const publicKey = await nodeAdapter.getPublicKey();

    // Compute actual contract address using OpenZeppelin account contract
    const constructorCalldata = CallData.compile({ publicKey });
    const contractAddress = hash.calculateContractAddressFromHash(
      publicKey,
      this.OZ_ACCOUNT_CLASS_HASH,
      constructorCalldata,
      0
    );

    // Ensure contract address is zero-padded to 64 hex chars (Starknet spec)
    const paddedAddress = contractAddress.startsWith("0x")
      ? "0x" + contractAddress.slice(2).padStart(64, "0")
      : "0x" + contractAddress.padStart(64, "0");

    console.log('[HDWALLET_STARKNET_DEBUG] getAddress:', JSON.stringify({
      bip32Path,
      publicKey,
      publicKeyLength: publicKey.length,
      constructorCalldata,
      contractAddress,
      contractAddressLength: contractAddress.length,
      paddedAddress,
      paddedAddressLength: paddedAddress.length,
    }, null, 2));

    return paddedAddress;
  }

  /**
   * Sign Starknet transaction
   * Starknet uses ECDSA on the STARK curve for transaction signing
   */
  async signTransaction(txHash: string, addressNList: core.BIP32Path): Promise<string[]> {
    console.log('[HDWALLET_STARKNET_DEBUG] signTransaction input:', JSON.stringify({
      txHash,
      txHashLength: txHash.length,
      addressNList,
    }, null, 2));

    const bip32Path = core.addressNListToBIP32(addressNList);
    console.log('[HDWALLET_STARKNET_DEBUG] bip32Path:', bip32Path);

    const nodeAdapter = await this.nodeAdapter.derivePath(bip32Path);
    const publicKey = await nodeAdapter.getPublicKey();
    console.log('[HDWALLET_STARKNET_DEBUG] publicKey for signing:', publicKey, 'length:', publicKey.length);

    const signature = await nodeAdapter.node.sign(txHash);
    console.log('[HDWALLET_STARKNET_DEBUG] signature result:', JSON.stringify({
      r: signature.r,
      rLength: signature.r.length,
      s: signature.s,
      sLength: signature.s.length,
    }, null, 2));

    return [signature.r, signature.s];
  }
}

export default StarknetAdapter;
