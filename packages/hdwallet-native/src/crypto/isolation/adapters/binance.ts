import type { Transaction, BncClient } from "bnb-javascript-sdk-nobroadcast";
import { BIP32, SecP256K1 } from "../core"

type SigningDelegate = Parameters<BncClient["setSigningDelegate"]>[0];

const crypto = (async () => (await import("bnb-javascript-sdk-nobroadcast")).crypto)()

export default {
  async create(keyPair: BIP32.Node): Promise<SigningDelegate> {
    return async (tx: Transaction, signMsg?: any): Promise<Transaction> => {
      const signBytes = tx.getSignBytes(signMsg);
      const pubKey = (await crypto).getPublicKey(Buffer.from(await keyPair.getPublicKey()).toString("hex"));
      const sig = Buffer.from(await SecP256K1.Signature.signCanonically(keyPair, "sha256", signBytes));
      tx.addSignature(pubKey, sig);
      return tx;
    };
  }
};
