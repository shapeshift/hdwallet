import { PublicKey, VersionedTransaction } from "@solana/web3.js";

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

  async getAddress(): Promise<string> {
    return this.address;
  }

  async signDirect(transaction: VersionedTransaction): Promise<VersionedTransaction> {
    const pubkey = new PublicKey(this._pubkey);

    const messageToSign = transaction.message.serialize();

    const signature = await this._isolatedKey.ecdsaSign("sha256", messageToSign);

    transaction.addSignature(pubkey, new Uint8Array(signature));

    return transaction;
  }
}

export { SolanaDirectAdapter as default };
