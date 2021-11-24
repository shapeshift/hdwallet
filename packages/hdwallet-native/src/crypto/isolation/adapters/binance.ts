import { Transaction, BncClient, crypto } from "bnb-javascript-sdk-nobroadcast";
import { BIP32, Digest, SecP256K1 } from "../core"

type SigningDelegate = Parameters<BncClient["setSigningDelegate"]>[0];

export default {
  async create(keyPair: BIP32.Node): Promise<SigningDelegate> {
    return async (tx: Transaction, signMsg?: any): Promise<Transaction> => {
      const signBytes = tx.getSignBytes(signMsg);
      const pubKey = crypto.getPublicKey(Buffer.from(await keyPair.getPublicKey()).toString("hex"));
      const sig = Buffer.from(await SecP256K1.Signature.signCanonically(keyPair, "sha256", signBytes));
      tx.addSignature(pubKey, sig);
      return tx;
    };
  }
};
