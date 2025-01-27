import * as core from "@shapeshiftoss/hdwallet-core";
import { PublicKey, VersionedTransaction } from "@solana/web3.js";

import { Isolation } from "../..";

export class SolanaAdapter {
  protected readonly nodeAdapter: Isolation.Adapters.Ed25519;

  constructor(nodeAdapter: Isolation.Adapters.Ed25519) {
    this.nodeAdapter = nodeAdapter;
  }

  async getAddress(addressNList: core.BIP32Path): Promise<string> {
    const nodeAdapter = await this.nodeAdapter.derivePath(core.addressNListToHardenedBIP32(addressNList));
    const publicKey = await nodeAdapter.getPublicKey();
    return new PublicKey(publicKey).toBase58();
  }

  async signTransaction(
    transaction: VersionedTransaction,
    addressNList: core.BIP32Path
  ): Promise<VersionedTransaction> {
    const nodeAdapter = await this.nodeAdapter.derivePath(core.addressNListToHardenedBIP32(addressNList));
    const publicKeyBuffer = await nodeAdapter.getPublicKey();
    const signature = await nodeAdapter.node.sign(transaction.message.serialize());
    transaction.addSignature(new PublicKey(publicKeyBuffer), signature);
    return transaction;
  }
}

export default SolanaAdapter;
