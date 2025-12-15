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
  console.log("[hdwallet-phantom] Account publicKey:", account.publicKey);

  // Phantom returns a base64 signature, but chain adapter expects hex
  // Convert base64 to hex
  const signatureBuffer = Buffer.from(result.signature, 'base64');
  const signatureHex = signatureBuffer.toString('hex');

  // Convert publicKey from Uint8Array or object with numeric keys to hex string
  let publicKeyBytes: Uint8Array;
  if (account.publicKey instanceof Uint8Array) {
    publicKeyBytes = account.publicKey;
  } else if (typeof account.publicKey === 'object' && account.publicKey !== null) {
    // Handle the case where it's an object with numeric keys
    const values = Object.values(account.publicKey);
    // Make sure we only get valid byte values
    const validBytes = values.filter((v): v is number => typeof v === 'number' && v >= 0 && v <= 255);
    publicKeyBytes = new Uint8Array(validBytes);
  } else {
    throw new Error("Invalid publicKey format");
  }

  // Sui Ed25519 public keys should be 32 bytes
  if (publicKeyBytes.length !== 32) {
    console.warn(`[hdwallet-phantom] Unexpected publicKey length: ${publicKeyBytes.length} bytes (expected 32)`);
  }

  const publicKey = Buffer.from(publicKeyBytes).toString('hex');

  console.log("[hdwallet-phantom] Returning signature (hex):", signatureHex);
  console.log("[hdwallet-phantom] Returning publicKey (hex):", publicKey);

  return {
    signature: signatureHex, // Convert base64 to hex for chain adapter
    publicKey,
  };
}

export async function suiSignMessage(message: Uint8Array, provider: PhantomSuiProvider): Promise<string | null> {
  const result = await provider.signPersonalMessage(message);
  return result.signature;
}