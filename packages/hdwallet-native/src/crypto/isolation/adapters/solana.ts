import * as core from "@shapeshiftoss/hdwallet-core";
import { PublicKey, VersionedTransaction } from "@solana/web3.js";

import BIP32Ed25519Adapter from "./bip32ed25519";

export class SolanaDirectAdapter {
  protected readonly nodeAdapter: BIP32Ed25519Adapter;

  constructor(nodeAdapter: BIP32Ed25519Adapter) {
    this.nodeAdapter = nodeAdapter;
  }

  async getAddress(addressNList: core.BIP32Path): Promise<string> {
    const nodeAdapter = await this.nodeAdapter.derivePath(core.addressNListToBIP32(addressNList));
    const publicKeyBuffer = nodeAdapter.getPublicKey();
    // Convert the public key to Solana format by reversing the bytes, something something Little vs. Big Endian
    const solanaFormat = Buffer.from(publicKeyBuffer).reverse();

    return new PublicKey(solanaFormat).toBase58();
  }

  async signDirect(transaction: VersionedTransaction, addressNList: core.BIP32Path): Promise<VersionedTransaction> {
    const nodeAdapter = await this.nodeAdapter.derivePath(core.addressNListToBIP32(addressNList));
    const pubkey = await this.getAddress(addressNList);

    const messageToSign = transaction.message.serialize();

    const signature = await nodeAdapter.node.sign(messageToSign);

    transaction.addSignature(new PublicKey(pubkey), signature);
    return transaction;
  }
}

export default SolanaDirectAdapter;
