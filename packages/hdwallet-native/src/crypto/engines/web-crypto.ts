import { CryptoEngine, ScryptParams } from "./index";
import { scrypt } from "scrypt-js";

export default class WebCryptoEngine implements CryptoEngine {
  public async decrypt(data: ArrayBuffer, key: ArrayBuffer, iv: ArrayBuffer): Promise<ArrayBuffer> {
    const impKey = await globalThis.crypto.subtle.importKey("raw", key, { name: "AES-CBC" }, false, ["decrypt"]);
    return await globalThis.crypto.subtle.decrypt({ name: "AES-CBC", iv }, impKey, data);
  }

  public async encrypt(data: ArrayBuffer, key: ArrayBuffer, iv: ArrayBuffer): Promise<ArrayBuffer> {
    const impKey = await globalThis.crypto.subtle.importKey("raw", key, { name: "AES-CBC" }, false, ["encrypt"]);
    return await globalThis.crypto.subtle.encrypt({ name: "AES-CBC", iv }, impKey, data);
  }

  public async hmac(value: ArrayBuffer, key: ArrayBuffer): Promise<ArrayBuffer> {
    const signingAlgorithm = {
      name: "HMAC",
      hash: { name: "SHA-256" },
    };

    const impKey = await globalThis.crypto.subtle.importKey("raw", key, signingAlgorithm, false, ["sign"]);
    return await globalThis.crypto.subtle.sign(signingAlgorithm, impKey, value);
  }

  public async pbkdf2(password: ArrayBuffer, salt: ArrayBuffer, options?: Pbkdf2Params) {
    const pbkdf2Params: Pbkdf2Params = {
      name: "PBKDF2",
      salt: new Uint8Array(salt),
      iterations: options?.iterations,
      hash: { name: "SHA-256" },
    };

    const impKey = await globalThis.crypto.subtle.importKey("raw", password, { name: "PBKDF2" }, false, ["deriveBits"]);
    return await globalThis.crypto.subtle.deriveBits(pbkdf2Params, impKey, 256);
  }

  public async randomBytes(size: number): Promise<ArrayBuffer> {
    return globalThis.crypto.getRandomValues(new Uint8Array(size));
  }

  public async scrypt(password: ArrayBuffer, salt: ArrayBuffer, params: ScryptParams): Promise<ArrayBuffer> {
    return (
      await scrypt(
        new Uint8Array(password),
        new Uint8Array(salt),
        params.iterations,
        params.blockSize,
        params.parallelism,
        params.keyLength
      )
    ).buffer;
  }
}
