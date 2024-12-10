import * as core from "@shapeshiftoss/hdwallet-core";
import { PublicKey } from "@solana/web3.js";

import { PhantomSolanaProvider } from "./types";

export type SolanaAccount = {
  publicKey: PublicKey;
};

export async function solanaSignTx(
  msg: core.SolanaSignTx,
  provider: PhantomSolanaProvider,
  address: string
): Promise<core.SolanaSignedTx | null> {
  const transaction = core.solanaBuildTransaction(msg, address);
  const signedTransaction = await provider.signTransaction(transaction);
  return {
    serialized: Buffer.from(signedTransaction.serialize()).toString("base64"),
    signatures: signedTransaction.signatures.map((signature) => Buffer.from(signature).toString("base64")),
  };
}

export async function solanaSendTx(
  msg: core.SolanaSignTx,
  provider: PhantomSolanaProvider,
  address: string
): Promise<core.SolanaTxSignature | null> {
  const transaction = core.solanaBuildTransaction(msg, address);
  const { signature } = await provider.signAndSendTransaction(transaction);
  return { signature };
}
