import * as core from "@shapeshiftoss/hdwallet-core";
import * as scryptJs from "scrypt-js";

import { CryptoEngine, DigestAlgorithm, ScryptParams } from "./types";

export class WebCryptoEngine implements CryptoEngine {
  public async decrypt(data: ArrayBuffer, key: ArrayBuffer, iv: ArrayBuffer): Promise<ArrayBuffer> {
    const impKey = await globalThis.crypto.subtle.importKey("raw", key, { name: "AES-CBC" }, false, ["decrypt"]);
    return globalThis.crypto.subtle.decrypt({ name: "AES-CBC", iv }, impKey, data);
  }

  public async digest(algorithm: DigestAlgorithm, data: ArrayBuffer): Promise<ArrayBuffer> {
    const alg = algorithm === DigestAlgorithm.SHA512 ? "SHA-512" : "SHA-256";
    return globalThis.crypto.subtle.digest(alg, data);
  }

  public async encrypt(data: ArrayBuffer, key: ArrayBuffer, iv: ArrayBuffer): Promise<ArrayBuffer> {
    const impKey = await globalThis.crypto.subtle.importKey("raw", key, { name: "AES-CBC" }, false, ["encrypt"]);
    return globalThis.crypto.subtle.encrypt({ name: "AES-CBC", iv }, impKey, data);
  }

  public async hmac(value: ArrayBuffer, key: ArrayBuffer): Promise<ArrayBuffer> {
    const signingAlgorithm = {
      name: "HMAC",
      hash: { name: "SHA-256" },
    };

    const impKey = await globalThis.crypto.subtle.importKey("raw", key, signingAlgorithm, false, ["sign"]);
    return globalThis.crypto.subtle.sign(signingAlgorithm, impKey, value);
  }

  public async pbkdf2(
    password: ArrayBuffer,
    salt: ArrayBuffer,
    options: Partial<Pbkdf2Params> & Pick<Pbkdf2Params, "iterations">
  ) {
    const pbkdf2Params: Pbkdf2Params = {
      name: "PBKDF2",
      salt: new Uint8Array(salt),
      hash: { name: "SHA-256" },
      ...options,
    };

    const impKey = await globalThis.crypto.subtle.importKey("raw", password, { name: "PBKDF2" }, false, ["deriveBits"]);
    return globalThis.crypto.subtle.deriveBits(pbkdf2Params, impKey, 256);
  }

  public async randomBytes(size: number): Promise<ArrayBuffer> {
    return core.toArrayBuffer(globalThis.crypto.getRandomValues(new Uint8Array(size)));
  }

  public async scrypt(password: ArrayBuffer, salt: ArrayBuffer, params: ScryptParams): Promise<ArrayBuffer> {
    return core.toArrayBuffer(
      await scryptJs.scrypt(
        new Uint8Array(password),
        new Uint8Array(salt),
        params.iterations,
        params.blockSize,
        params.parallelism,
        params.keyLength
      )
    );
  }
}
