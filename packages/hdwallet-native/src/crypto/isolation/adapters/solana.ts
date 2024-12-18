import { PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";

import { SecP256K1 } from "../core";

export class SolanaDirectAdapter {
  protected readonly _isolatedKey: SecP256K1.ECDSAKey;
  protected readonly _pubkey: Uint8Array;
  readonly address: string;

  protected constructor(isolatedKey: SecP256K1.ECDSAKey, pubkey: Uint8Array, address: string) {
    this._isolatedKey = isolatedKey;
    this._pubkey = pubkey;
    this.address = address;
  }

  static async create(isolatedKey: SecP256K1.ECDSAKey): Promise<SolanaDirectAdapter> {
    const pubkey = await isolatedKey.getPublicKey();
    const address = new PublicKey(pubkey).toString();
    return new SolanaDirectAdapter(isolatedKey, pubkey, address);
  }

  async signDirect(transaction: VersionedTransaction): Promise<VersionedTransaction> {
    const pubkey = new PublicKey(this._pubkey);

    // Get the message to sign
    const messageToSign =
      transaction instanceof Transaction ? transaction.serializeMessage() : transaction.message.serialize();

    // Sign using the isolated key
    const signature = await this._isolatedKey.ecdsaSign("sha256", messageToSign);

    // Add the signature to the transaction
    if (transaction instanceof Transaction) {
      transaction.addSignature(pubkey, Buffer.from(signature));
    } else {
      transaction.addSignature(pubkey, new Uint8Array(signature));
    }

    return transaction;
  }
}

export default SolanaDirectAdapter;
