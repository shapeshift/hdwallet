import * as core from "@shapeshiftoss/hdwallet-core";
import { PublicKey, VersionedTransaction } from "@solana/web3.js";

import { Isolation } from "../..";
import { SecP256K1 } from "../core";

export class SolanaDirectAdapter {
  protected readonly nodeAdapter: Isolation.Adapters.BIP32;

  constructor(nodeAdapter: Isolation.Adapters.BIP32) {
    this.nodeAdapter = nodeAdapter;
  }

  async getAddress(addressNList: core.BIP32Path): Promise<string> {
    const nodeAdapter = await this.nodeAdapter.derivePath(core.addressNListToBIP32(addressNList));
    const publicKeyBytes = Buffer.from(SecP256K1.CompressedPoint.from(nodeAdapter.getPublicKey()));

    // strip the 0x02 compressed point prefix to make it a valid PublicKey input
    return new PublicKey(publicKeyBytes.slice(1)).toBase58();
  }
  async signDirect(transaction: VersionedTransaction, addressNList: core.BIP32Path): Promise<VersionedTransaction> {
    const nodeAdapter = await this.nodeAdapter.derivePath(core.addressNListToBIP32(addressNList));
    const pubkey = await this.getAddress(addressNList);

    const messageToSign = transaction.message.serialize();
    const signature = await nodeAdapter.node.ecdsaSign("sha256", messageToSign);

    transaction.addSignature(new PublicKey(pubkey), new Uint8Array(signature));
    return transaction;
  }
}

export default SolanaDirectAdapter;
