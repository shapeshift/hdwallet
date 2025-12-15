import * as core from "@shapeshiftoss/hdwallet-core";

import { PhantomSuiProvider } from "./types";

export async function suiGetAddress(provider: PhantomSuiProvider): Promise<string | null> {
  // Phantom Sui uses requestAccount instead of connect
  const account = await provider.requestAccount();

  console.log("[hdwallet-phantom] Sui account from requestAccount:", account);
  console.log("[hdwallet-phantom] Sui publicKey type:", typeof account.publicKey);
  console.log("[hdwallet-phantom] Sui publicKey value:", account.publicKey);

  // Check if publicKey is already a hex string with 0x prefix
  if (typeof account.publicKey === 'string' && account.publicKey.startsWith('0x')) {
    console.log("[hdwallet-phantom] Returning publicKey as-is (already 0x-prefixed)");
    return account.publicKey;
  }

  // If it's a string without 0x prefix, add it
  if (typeof account.publicKey === 'string' && /^[0-9a-fA-F]{64}$/.test(account.publicKey)) {
    const address = '0x' + account.publicKey;
    console.log("[hdwallet-phantom] Adding 0x prefix, returning:", address);
    return address;
  }

  // If publicKey looks like a comma-separated string of numbers, convert to hex
  if (typeof account.publicKey === 'string' && account.publicKey.includes(',')) {
    console.log("[hdwallet-phantom] Detected comma-separated format, converting to hex");
    const bytes = account.publicKey.split(',').map(b => parseInt(b.trim()));
    const hexString = '0x' + Buffer.from(bytes).toString('hex');
    console.log("[hdwallet-phantom] Converted to hex:", hexString);
    return hexString;
  }

  // If it's an array or Uint8Array, convert to hex
  if (Array.isArray(account.publicKey) || (account.publicKey as any) instanceof Uint8Array) {
    const bytes = Array.from(account.publicKey as any);
    const hexString = '0x' + Buffer.from(bytes as number[]).toString('hex');
    console.log("[hdwallet-phantom] Converted array to hex:", hexString);
    return hexString;
  }

  console.warn("[hdwallet-phantom] Unexpected publicKey format, returning as-is:", account.publicKey);
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

  // Convert publicKey to proper hex format if needed
  let publicKey = account.publicKey;

  if (typeof publicKey === 'string' && publicKey.includes(',')) {
    // Handle comma-separated format
    const bytes = publicKey.split(',').map(b => parseInt(b.trim()));
    publicKey = Buffer.from(bytes).toString('hex');
  } else if (Array.isArray(publicKey) || (publicKey as any) instanceof Uint8Array) {
    // Handle array format
    publicKey = Buffer.from(Array.from(publicKey as any)).toString('hex');
  } else if (typeof publicKey === 'string' && publicKey.startsWith('0x')) {
    // Remove 0x prefix for the signature response
    publicKey = publicKey.slice(2);
  }

  return {
    signature: result.signature,
    publicKey,
  };
}

export async function suiSignMessage(message: Uint8Array, provider: PhantomSuiProvider): Promise<string | null> {
  const result = await provider.signPersonalMessage(message);
  return result.signature;
}