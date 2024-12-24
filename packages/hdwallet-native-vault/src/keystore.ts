// src/keystore.ts
import { blake2bFinal, blake2bInit, blake2bUpdate } from "blakejs";

import { crypto, encoder } from "./util";

export interface XChainKeystore {
  crypto: {
    cipher: string;
    ciphertext: string;
    cipherparams: {
      iv: string;
    };
    kdf: string;
    kdfparams: {
      prf: string;
      dklen: number;
      salt: string;
      c: number;
    };
    mac: string;
  };
  version: number;
  meta: string;
}

function blake256(data: Uint8Array): string {
  const context = blake2bInit(32);
  blake2bUpdate(context, data);
  return Buffer.from(blake2bFinal(context)).toString("hex");
}

/**
 * Decrypts a ThorSwap/XChain compatible keystore
 */
export async function decryptFromKeystore(keystore: XChainKeystore, password: string): Promise<string> {
  // eslint-disable-next-line no-debugger
  debugger;
  if (keystore.version !== 1 || keystore.meta !== "xchain-keystore") {
    throw new Error("Invalid keystore format");
  }

  const { kdfparams } = keystore.crypto;

  // Derive key using PBKDF2
  const passwordKey = await (
    await crypto
  ).subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);

  const derivedKey = new Uint8Array(
    await (
      await crypto
    ).subtle.deriveBits(
      {
        name: "PBKDF2",
        salt: Buffer.from(kdfparams.salt, "hex"),
        iterations: kdfparams.c,
        hash: "SHA-256",
      },
      passwordKey,
      kdfparams.dklen * 8
    )
  );

  // Verify MAC
  const ciphertext = Buffer.from(keystore.crypto.ciphertext, "hex");
  const mac = blake256(Buffer.concat([Buffer.from(derivedKey.subarray(16, 32)), ciphertext]));

  if (mac !== keystore.crypto.mac) {
    throw new Error("Invalid password");
  }

  // Import key for AES
  const aesKey = await (
    await crypto
  ).subtle.importKey(
    "raw",
    derivedKey.subarray(0, 16),
    {
      name: "AES-CTR",
      length: 128,
    },
    false,
    ["decrypt"]
  );

  // Decrypt using AES-CTR
  const iv = Buffer.from(keystore.crypto.cipherparams.iv, "hex");
  const counter = new Uint8Array(16);
  counter.set(iv);

  const decrypted = await (
    await crypto
  ).subtle.decrypt(
    {
      name: "AES-CTR",
      counter,
      length: 128,
    },
    aesKey,
    ciphertext
  );

  return new TextDecoder().decode(decrypted);
}

// Register keystore value transformer
export const registerKeystoreTransformers = (Vault: any) => {
  // eslint-disable-next-line no-debugger
  debugger;
  Vault.registerValueTransformer("#keystore", async (value: unknown) => {
    if (!value || typeof value !== "string") return value;

    try {
      const keystore = JSON.parse(value) as XChainKeystore;
      if (keystore.version !== 1 || keystore.meta !== "xchain-keystore") {
        throw new Error("Invalid keystore format");
      }
      return keystore;
    } catch {
      return value;
    }
  });
};
