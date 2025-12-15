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
  // The intentMessageBytes comes as an object with numeric keys, convert to Uint8Array
  let bytes: Uint8Array;
  if (msg.intentMessageBytes instanceof Uint8Array) {
    bytes = msg.intentMessageBytes;
  } else if (typeof msg.intentMessageBytes === 'object') {
    // Handle the case where it's an object with numeric keys (like {0: 0, 1: 0, ...})
    const length = Object.keys(msg.intentMessageBytes).length;
    bytes = new Uint8Array(length);
    for (let i = 0; i < length; i++) {
      bytes[i] = (msg.intentMessageBytes as any)[i];
    }
  } else {
    throw new Error("Invalid intentMessageBytes format");
  }

  // Get the account for address
  const account = await provider.requestAccount();

  // Convert Uint8Array to base64 for Phantom
  const intentMessageB64 = Buffer.from(bytes).toString("base64");

  console.log("[hdwallet-phantom] Signing Sui transaction with params:", {
    transactionPreview: intentMessageB64.substring(0, 50) + "...",
    address: account.address,
    networkID: "sui:mainnet"
  });

  // Try using signTransaction with the format Phantom expects
  const result = await provider.signTransaction({
    transaction: { transactionBlockSerialized: intentMessageB64 }, // Wrapped in transaction object
    address: account.address,
    networkID: "sui:mainnet" // According to Phantom docs
  });

  console.log("[hdwallet-phantom] Sui transaction signed:", result);

  // Convert publicKey from Uint8Array or object with numeric keys to hex string
  let publicKeyBytes: Uint8Array;
  if (account.publicKey instanceof Uint8Array) {
    publicKeyBytes = account.publicKey;
  } else if (typeof account.publicKey === 'object') {
    // Handle the case where it's an object with numeric keys
    const length = Object.keys(account.publicKey).length;
    publicKeyBytes = new Uint8Array(length);
    for (let i = 0; i < length; i++) {
      publicKeyBytes[i] = (account.publicKey as any)[i];
    }
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