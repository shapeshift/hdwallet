import * as core from "@shapeshiftoss/hdwallet-core";

import type { SeekerProvider } from "./types";

/**
 * Signs a Solana transaction using the Seeker wallet via MWA
 */
export async function solanaSignTx(
  msg: core.SolanaSignTx,
  provider: SeekerProvider,
  address: string
): Promise<core.SolanaSignedTx | null> {
  const transaction = core.solanaBuildTransaction(msg, address);
  const [signedTransaction] = await provider.signTransactions([transaction]);

  return {
    serialized: Buffer.from(signedTransaction.serialize()).toString("base64"),
    signatures: signedTransaction.signatures.map((signature) => Buffer.from(signature).toString("base64")),
  };
}

/**
 * Signs and sends a Solana transaction using the Seeker wallet via MWA
 */
export async function solanaSendTx(
  msg: core.SolanaSignTx,
  provider: SeekerProvider,
  address: string
): Promise<core.SolanaTxSignature | null> {
  const transaction = core.solanaBuildTransaction(msg, address);
  const [signature] = await provider.signAndSendTransactions([transaction]);

  return { signature };
}
