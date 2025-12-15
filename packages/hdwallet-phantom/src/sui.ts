import * as core from "@shapeshiftoss/hdwallet-core";

import { PhantomSuiProvider } from "./types";

export async function suiGetAddress(provider: PhantomSuiProvider): Promise<string | null> {
  // Phantom Sui uses requestAccount instead of connect
  const account = await provider.requestAccount();
  return account.publicKey;
}

export async function suiSignTx(
  msg: core.SuiSignTx,
  provider: PhantomSuiProvider
): Promise<core.SuiSignedTx | null> {
  // Convert Uint8Array to base64 for Phantom
  const intentMessageB64 = Buffer.from(msg.intentMessageBytes).toString("base64");

  const result = await provider.signAndExecuteTransaction({
    transactionBlockSerialized: intentMessageB64,
  });

  // Get the public key for the response
  const account = await provider.requestAccount();

  return {
    signature: result.signature,
    publicKey: account.publicKey,
  };
}

export async function suiSignMessage(message: Uint8Array, provider: PhantomSuiProvider): Promise<string | null> {
  const result = await provider.signPersonalMessage(message);
  return result.signature;
}