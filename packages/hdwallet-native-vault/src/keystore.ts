import { blake2bFinal, blake2bInit, blake2bUpdate } from "blakejs";

import { crypto, encoder } from "./util";
import { Vault } from "./vault";

// https://github.com/thorswap/SwapKit/blob/349a9212d8357cc35a8bab771728bbc8d6900ebc/packages/wallets/keystore/src/helpers.ts#L6
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

// https://github.com/thorswap/SwapKit/blob/349a9212d8357cc35a8bab771728bbc8d6900ebc/packages/wallets/keystore/src/helpers.ts#L29-L42
function blake256(data: Uint8Array): string {
  const context = blake2bInit(32);
  blake2bUpdate(context, data);
  return Buffer.from(blake2bFinal(context)).toString("hex");
}

// https://github.com/thorswap/SwapKit/blob/349a9212d8357cc35a8bab771728bbc8d6900ebc/packages/wallets/keystore/src/helpers.ts#L102
export async function decryptFromKeystore(keystore: XChainKeystore, password: string): Promise<string> {
  if (keystore.version !== 1 || keystore.meta !== "xchain-keystore") {
    throw new Error("Invalid keystore format");
  }

  const { kdfparams } = keystore.crypto;

  // Derive key using PBKDF2 similar to SwapKit's `pbkdf2Async` call
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

  const ciphertext = Buffer.from(keystore.crypto.ciphertext, "hex");
  const mac = blake256(Buffer.concat([Buffer.from(derivedKey.subarray(16, 32)), ciphertext]));

  if (mac !== keystore.crypto.mac) {
    throw new Error("Invalid password");
  }

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

export const registerKeystoreTransformers = () => {
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
