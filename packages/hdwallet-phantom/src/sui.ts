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
  console.log("[hdwallet-phantom] Signature from Phantom:", result.signature);

  // Phantom returns a base64 signature that includes flag + signature + publicKey (97 bytes total)
  // We need to split it: flag (1) + signature (64) + publicKey (32)
  const fullSignatureBuffer = Buffer.from(result.signature, 'base64');

  console.log(`[hdwallet-phantom] Full signature length: ${fullSignatureBuffer.length} bytes`);

  if (fullSignatureBuffer.length === 97) {
    // Extract parts from the full signature
    // Skip flag at position 0
    const signatureBytes = fullSignatureBuffer.slice(1, 65); // 64 bytes signature
    const publicKeyBytes = fullSignatureBuffer.slice(65, 97); // 32 bytes publicKey

    const signatureHex = signatureBytes.toString('hex');
    const publicKeyHex = publicKeyBytes.toString('hex');

    console.log("[hdwallet-phantom] Extracted signature (hex):", signatureHex);
    console.log("[hdwallet-phantom] Extracted publicKey (hex):", publicKeyHex);

    return {
      signature: signatureHex, // Just the 64-byte signature (same format as native)
      publicKey: publicKeyHex, // Just the 32-byte publicKey (same format as native)
    };
  } else {
    throw new Error(`[hdwallet-phantom] Unexpected signature length: ${fullSignatureBuffer.length} bytes (expected 97)`);
  }
}

export async function suiSignMessage(message: Uint8Array, provider: PhantomSuiProvider): Promise<string | null> {
  const result = await provider.signPersonalMessage(message);
  return result.signature;
}