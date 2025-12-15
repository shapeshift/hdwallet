import * as core from "@shapeshiftoss/hdwallet-core";

import { PhantomSuiProvider } from "./types";

export async function suiGetAddress(provider: PhantomSuiProvider): Promise<string | null> {
  // Phantom Sui uses requestAccount instead of connect
  const account = await provider.requestAccount();

  console.log("[hdwallet-phantom] Sui account from requestAccount:", account);

  // Phantom returns an object with both 'address' and 'publicKey' fields
  // We need the 'address' field, not the publicKey
  if (account && account.address) {
    console.log("[hdwallet-phantom] Using account.address:", account.address);
    return account.address;
  }

  console.warn("[hdwallet-phantom] Unexpected account format - no address field:", account);
  return null;
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

  // Convert publicKey from Uint8Array to hex string (without 0x prefix for signature response)
  const publicKey = Buffer.from(account.publicKey).toString('hex');

  return {
    signature: result.signature,
    publicKey,
  };
}

export async function suiSignMessage(message: Uint8Array, provider: PhantomSuiProvider): Promise<string | null> {
  const result = await provider.signPersonalMessage(message);
  return result.signature;
}