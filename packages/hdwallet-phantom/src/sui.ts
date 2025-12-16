import * as core from "@shapeshiftoss/hdwallet-core";

import { PhantomSuiProvider } from "./types";

export async function suiGetAddress(provider: PhantomSuiProvider): Promise<string | null> {
  const account = await provider.requestAccount();

  if (account && account.address) return account.address;

  return null;
}

export async function suiSignTx(msg: core.SuiSignTx, provider: PhantomSuiProvider): Promise<core.SuiSignedTx | null> {
  const account = await provider.requestAccount();

  const result = await provider.signTransaction({
    transaction: msg.transactionJson,
    address: account.address,
    networkID: "sui:mainnet",
  });

  const fullSignatureBuffer = Buffer.from(result.signature, "base64");

  // Phantom returns a 97-byte signature: 1 byte flag + 64 bytes signature + 32 bytes public key
  if (fullSignatureBuffer.length !== 97) {
    throw new Error(`Unexpected signature length: ${fullSignatureBuffer.length} bytes (expected 97)`);
  }

  const signatureBytes = fullSignatureBuffer.slice(1, 65);
  const publicKeyBytes = fullSignatureBuffer.slice(65, 97);

  const signatureHex = signatureBytes.toString("hex");
  const publicKeyHex = publicKeyBytes.toString("hex");

  return {
    signature: signatureHex,
    publicKey: publicKeyHex,
  };
}

export async function suiSignMessage(message: Uint8Array, provider: PhantomSuiProvider): Promise<string | null> {
  const result = await provider.signMessage(message);
  return result.signature;
}
