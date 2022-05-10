import type { BncClient, Transaction } from "bnb-javascript-sdk-nobroadcast";
import PLazy from "p-lazy";

import { BIP32, SecP256K1 } from "../core";

type SigningDelegate = Parameters<BncClient["setSigningDelegate"]>[0];

const bnbSdk = PLazy.from(() => import("bnb-javascript-sdk-nobroadcast"));

export default {
  async create(keyPair: BIP32.Node): Promise<SigningDelegate> {
    return async (tx: Transaction, signMsg?: any): Promise<Transaction> => {
      const signBytes = tx.getSignBytes(signMsg);
      const pubKey = (await bnbSdk).crypto.getPublicKey(Buffer.from(await keyPair.getPublicKey()).toString("hex"));
      const sig = Buffer.from(await SecP256K1.Signature.signCanonically(keyPair, "sha256", signBytes));
      tx.addSignature(pubKey, sig);
      return tx;
    };
  },
};
