import * as core from "@shapeshiftoss/hdwallet-core";

import { PhantomSuiProvider } from "./types";

export async function suiGetAddress(provider: PhantomSuiProvider): Promise<string | null> {
  const account = await provider.requestAccount();

  if (account && account.address) {
    return account.address;
  }

  return null;
}

export async function suiSignTx(msg: core.SuiSignTx, provider: PhantomSuiProvider): Promise<core.SuiSignedTx | null> {
  const account = await provider.requestAccount();

  let transaction: string;

  if (msg.transactionJson) {
    transaction = msg.transactionJson;
  } else {
    let bytes: Uint8Array;
    if (msg.intentMessageBytes instanceof Uint8Array) {
      bytes = msg.intentMessageBytes;
    } else if (typeof msg.intentMessageBytes === "object") {
      bytes = new Uint8Array(Object.values(msg.intentMessageBytes));
    } else {
      throw new Error("Invalid intentMessageBytes format");
    }
    transaction = Buffer.from(bytes).toString("base64");
  }

  const result = await provider.signTransaction({
    transaction,
    address: account.address,
    networkID: "sui:mainnet",
  });

  const fullSignatureBuffer = Buffer.from(result.signature, "base64");

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
  const result = await provider.signPersonalMessage(message);
  return result.signature;
}
