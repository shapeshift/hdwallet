import { blake2bHex } from "blakejs";

import { crypto as asyncCrypto, decoder, encoder } from "./util";

// https://github.com/ethereum/go-ethereum/blob/033de2a05bdbea87b4efc5156511afe42c38fd55/accounts/keystore/key.go#L80
// https://github.com/thorswap/SwapKit/blob/e5ff01b683f270e187d8c08d4e8a1c4e0af56f98/packages/wallets/keystore/src/helpers.ts#L6
export interface Keystore {
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
}

// https://github.com/ethereum/go-ethereum/blob/033de2a05bdbea87b4efc5156511afe42c38fd55/accounts/keystore/passphrase.go#L200
// https://github.com/thorswap/SwapKit/blob/e5ff01b683f270e187d8c08d4e8a1c4e0af56f98/packages/wallets/keystore/src/helpers.ts#L103
export async function decryptFromKeystore(keystore: Keystore, password: string): Promise<string> {
  const { cipher, cipherparams, ciphertext, kdf, kdfparams, mac } = keystore.crypto;
  const { c, dklen, prf, salt } = kdfparams;
  const { iv } = cipherparams;

  if (kdf !== "pbkdf2") throw new Error(`Unsupported KDF: ${kdf}`);
  if (prf !== "hmac-sha256") throw new Error(`Unsupported PBKDF2 PRF: ${prf}`);
  if (cipher !== "aes-128-ctr") throw new Error(`Unsupported Cipher: ${cipher}`);

  const baseKey = await (
    await asyncCrypto
  ).subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);

  const derivedKey = new Uint8Array(
    await (
      await asyncCrypto
    ).subtle.deriveBits(
      {
        name: "PBKDF2",
        salt: Buffer.from(salt, "hex"),
        iterations: c,
        hash: "SHA-256",
      },
      baseKey,
      dklen * 8 // convert dklen from bytes to bits
    )
  );

  const data = Buffer.concat([derivedKey.subarray(16, 32), Buffer.from(ciphertext, "hex")]);

  // thorswap uses blake256
  const macBlake256 = blake2bHex(data, undefined, 32);

  // evm wallets use keccak256
  // TODO: evm wallets use keccak256 would be nice-to-have, though currently throwing at
  // "sha3-256 is not supported (we accept pull requests)"
  // const macKeccak256 = crypto.createHash("sha3-256").update(data).digest("hex");

  if (macBlake256 !== mac) throw new Error("Invalid password");

  const aesKey = await (
    await asyncCrypto
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

  const decrypted = await (
    await asyncCrypto
  ).subtle.decrypt(
    {
      name: "AES-CTR",
      counter: new Uint8Array(Buffer.from(iv, "hex")),
      length: 128,
    },
    aesKey,
    Buffer.from(ciphertext, "hex")
  );

  return decoder.decode(decrypted);
}
