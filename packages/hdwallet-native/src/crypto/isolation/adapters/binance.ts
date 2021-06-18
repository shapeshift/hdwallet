import { Transaction, BncClient, crypto } from "bnb-javascript-sdk-nobroadcast";
import { BIP32, Digest, SecP256K1 } from "../core"

type SigningDelegate = Parameters<BncClient["setSigningDelegate"]>[0];

export function signingDelegate(keyPair: BIP32.Node): SigningDelegate {
    return async (tx: Transaction, signMsg?: any): Promise<Transaction> => {
        const signBytes = tx.getSignBytes(signMsg);
        const signHash = Digest.Algorithms["sha256"](signBytes);
        const pubKey = crypto.getPublicKey(Buffer.from(keyPair.publicKey).toString("hex"));
        const sig = Buffer.from(await SecP256K1.Signature.signCanonically(keyPair, signHash));
        tx.addSignature(pubKey, sig);
        return tx;
    };
}

export default signingDelegate;
