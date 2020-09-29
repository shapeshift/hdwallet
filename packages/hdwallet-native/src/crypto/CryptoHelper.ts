import { entropyToMnemonic } from "bip39";
import { CipherString, EncryptedObject, EncryptionType, SymmetricCryptoKey } from "./classes";
import { CryptoEngine } from "./engines";
import * as utils from "./utils";

export default class CryptoHelper {
  readonly #engine: CryptoEngine;

  constructor(engine: CryptoEngine) {
    if (!engine) {
      throw new Error("Missing cryptography engine");
    }
    this.#engine = engine;
  }

  // Safely compare two values in a way that protects against timing attacks (Double HMAC Verification).
  // ref: https://www.nccgroup.trust/us/about-us/newsroom-and-events/blog/2011/february/double-hmac-verification/
  // ref: https://paragonie.com/blog/2015/11/preventing-timing-attacks-on-string-comparison-with-double-hmac-strategy
  async compare(a: ArrayBuffer, b: ArrayBuffer): Promise<boolean> {
    const macKey = await this.#engine.randomBytes(32);

    const mac1 = await this.#engine.hmac(a, macKey);
    const mac2 = await this.#engine.hmac(b, macKey);

    if (mac1.byteLength !== mac2.byteLength) {
      return false;
    }

    const arr1 = new Uint8Array(mac1);
    const arr2 = new Uint8Array(mac2);
    for (let i = 0; i < arr2.length; i++) {
      if (arr1[i] !== arr2[i]) {
        return false;
      }
    }

    return true;
  }

  async aesEncrypt(data: ArrayBuffer, key: SymmetricCryptoKey): Promise<EncryptedObject> {
    const iv = await this.#engine.randomBytes(16);

    const obj = new EncryptedObject();
    obj.key = key;
    obj.iv = iv;
    obj.data = await this.#engine.encrypt(data, key.encKey, iv);

    if (key.macKey != null) {
      const macData = new Uint8Array(obj.iv.byteLength + obj.data.byteLength);

      macData.set(new Uint8Array(obj.iv), 0);
      macData.set(new Uint8Array(obj.data), obj.iv.byteLength);

      obj.mac = await this.#engine.hmac(macData.buffer, obj.key.macKey);
    }

    return obj;
  }

  async aesDecrypt(
    encType: EncryptionType,
    data: ArrayBuffer,
    iv: ArrayBuffer,
    mac: ArrayBuffer,
    key: SymmetricCryptoKey
  ): Promise<ArrayBuffer> {
    if (key.macKey != null && mac == null) {
      console.warn("mac required.");
      return null;
    }

    if (key.encType !== encType) {
      console.warn("encType required.");
      return null;
    }

    if (key.macKey != null && mac != null) {
      const macData = new Uint8Array(iv.byteLength + data.byteLength);

      macData.set(new Uint8Array(iv), 0);
      macData.set(new Uint8Array(data), iv.byteLength);

      const computedMac = await this.#engine.hmac(macData.buffer, key.macKey);

      if (computedMac === null) {
        return null;
      }

      const macsMatch = await this.compare(mac, computedMac);

      if (!macsMatch) {
        console.warn("mac failed.", {
          encType,
          macData: Buffer.from(macData).toString("base64"),
          iv,
          key,
          mac: Buffer.from(mac).toString("hex"),
          computedMac: Buffer.from(computedMac).toString("hex"),
        });
        return null;
      }
    }

    return this.#engine.decrypt(data, key.encKey, iv);
  }

  // @see: https://tools.ietf.org/html/rfc5869
  async hkdfExpand(prk: ArrayBuffer, info: Uint8Array, size: number): Promise<Uint8Array> {
    const hashLen = 32; // sha256
    const okm = new Uint8Array(size);

    let previousT = new Uint8Array(0);

    const n = Math.ceil(size / hashLen);
    for (let i = 0; i < n; i++) {
      const t = new Uint8Array(previousT.length + info.length + 1);

      t.set(previousT);
      t.set(info, previousT.length);
      t.set([i + 1], t.length - 1);

      previousT = new Uint8Array(await this.#engine.hmac(t.buffer, prk));

      okm.set(previousT, i * hashLen);
    }

    return okm;
  }

  async stretchKey(key: SymmetricCryptoKey): Promise<SymmetricCryptoKey> {
    if (key.key.byteLength === 32) {
      const newKey = new Uint8Array(64);

      newKey.set(await this.hkdfExpand(key.key, utils.fromUtf8ToArray("enc"), 32));
      newKey.set(await this.hkdfExpand(key.key, utils.fromUtf8ToArray("mac"), 32), 32);

      return new SymmetricCryptoKey(newKey.buffer);
    } else if (key.key.byteLength === 64) {
      return key;
    } else {
      throw new Error("Invalid key size.");
    }
  }

  async pbkdf2(password: string | ArrayBuffer, salt: string | ArrayBuffer, iterations: number): Promise<ArrayBuffer> {
    password = utils.toArrayBuffer(password);
    salt = utils.toArrayBuffer(salt);

    return this.#engine.pbkdf2(password, salt, { iterations, keyLen: 32 });
  }

  async hashPassword(password: string, key: SymmetricCryptoKey): Promise<string> {
    if (!password || !key) {
      throw new Error("A password and symmetric crypto key are required to hash the password.");
    }

    const digest = await this.pbkdf2(key.key, password, 1);
    return Buffer.from(digest).toString("base64");
  }

  async makeKey(password: string, email: string): Promise<SymmetricCryptoKey> {
    if (!password || !email) {
      throw new Error("A password and email are required to make a symmetric crypto key.");
    }

    const salt = utils.toArrayBuffer(email);
    const key = await this.#engine.scrypt(utils.toArrayBuffer(password), salt, {
      iterations: 16384,
      blockSize: 8,
      parallelism: 1,
      keyLength: 32,
    });

    return new SymmetricCryptoKey(key);
  }

  async decryptToUtf8(cipherString: CipherString, key: SymmetricCryptoKey): Promise<string> {
    const data = utils.fromB64ToArray(cipherString.data);
    const iv = utils.fromB64ToArray(cipherString.iv);
    const mac = cipherString.mac ? utils.fromB64ToArray(cipherString.mac) : null;
    const decipher = await this.aesDecrypt(cipherString.encryptionType, data, iv, mac, key);

    if (decipher == null) {
      return null;
    }

    return utils.fromBufferToUtf8(decipher);
  }

  async decryptWallet(cipherString: CipherString, key: SymmetricCryptoKey): Promise<string> {
    return this.decryptToUtf8(cipherString, await this.stretchKey(key));
  }

  // bip39.generateMnemonic rng callback function signature didn't match RNSimpleCrypto
  // use bip39.entropyToMenmonic to generate mnemonic instead so we can utilize randomBytes
  async generateMnemonic(strength: number = 128): Promise<string> {
    const entropy = await this.#engine.randomBytes(strength / 8);
    return entropyToMnemonic(Buffer.from(entropy));
  }
}
