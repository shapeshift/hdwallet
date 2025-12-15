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
  // Get the account for address
  const account = await provider.requestAccount();

  // If transactionJson is provided, use it (for Phantom)
  // Otherwise fall back to intentMessageBytes (for backward compatibility)
  let transaction: string;

  if (msg.transactionJson) {
    // Use the JSON format that Phantom expects
    transaction = msg.transactionJson;
    console.log("[hdwallet-phantom] Using transactionJson for signing");
  } else {
    // Fallback to intentMessageBytes
    console.log("[hdwallet-phantom] Falling back to intentMessageBytes");

    // The intentMessageBytes comes as an object with numeric keys, convert to Uint8Array
    let bytes: Uint8Array;
    if (msg.intentMessageBytes instanceof Uint8Array) {
      bytes = msg.intentMessageBytes;
    } else if (typeof msg.intentMessageBytes === 'object') {
      // Handle the case where it's an object with numeric keys
      // Use the cleaner approach with Object.values
      bytes = new Uint8Array(Object.values(msg.intentMessageBytes));
    } else {
      throw new Error("Invalid intentMessageBytes format");
    }

    // Convert Uint8Array to base64 for Phantom (fallback, shouldn't be used normally)
    transaction = Buffer.from(bytes).toString("base64");
  }

  console.log("[hdwallet-phantom] Signing Sui transaction with params:", {
    transactionPreview: transaction.substring(0, 50) + "...",
    address: account.address,
    networkID: "sui:mainnet"
  });

  // Call signTransaction with the string directly
  const result = await provider.signTransaction({
    transaction, // Pass the JSON string directly
    address: account.address,
    networkID: "sui:mainnet"
  });

  console.log("[hdwallet-phantom] Sui transaction signed:", result);

  // Convert publicKey from Uint8Array or object with numeric keys to hex string
  let publicKeyBytes: Uint8Array;
  if (account.publicKey instanceof Uint8Array) {
    publicKeyBytes = account.publicKey;
  } else if (typeof account.publicKey === 'object') {
    // Use the cleaner approach with Object.values
    publicKeyBytes = new Uint8Array(Object.values(account.publicKey));
  } else {
    throw new Error("Invalid publicKey format");
  }

  const publicKey = Buffer.from(publicKeyBytes).toString('hex');

  return {
    signature: result.signature,
    publicKey,
  };
}

export async function suiSignMessage(message: Uint8Array, provider: PhantomSuiProvider): Promise<string | null> {
  const result = await provider.signPersonalMessage(message);
  return result.signature;
}