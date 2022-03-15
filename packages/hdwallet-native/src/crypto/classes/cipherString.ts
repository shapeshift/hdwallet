/*
 Copied from portis: packages/portis-crypto/src/models/cipherString.ts
 */
import { fromB64ToArray, fromBufferToB64 } from "../utils";
import { EncryptedObject } from "./encryptedObject";
import { EncryptionType } from "./encryptionType";
import { SymmetricCryptoKey } from "./symmetricCryptoKey";

export class CipherString {
  readonly encryptionType: EncryptionType = EncryptionType.AesCbc256_HmacSha256_B64;
  data: string;
  iv: string;
  mac: string;

  constructor(cipher: string | EncryptedObject) {
    let data: string | undefined, iv: string | undefined, mac: string | undefined;
    if (typeof cipher === "string") {
      try {
        const header = cipher.split(".");
        this.encryptionType = Number(header[0]);
        [data, iv, mac] = header[1].split("|");
      } catch (e) {
        throw new Error("Invalid cipher string");
      }
    } else if (cipher instanceof EncryptedObject) {
      try {
        this.encryptionType = cipher.key.encType;
        if (cipher.iv) iv = fromBufferToB64(cipher.iv);
        if (cipher.data) data = fromBufferToB64(cipher.data);
        if (cipher.mac) mac = fromBufferToB64(cipher.mac);
      } catch {
        throw new Error("Invalid encryption object");
      }
    } else {
      throw new Error("Invalid cipher data. You must provide a string or Encrypted Object");
    }

    if (!EncryptionType[this.encryptionType]) {
      throw new Error("Unsupported encryption method");
    }
    if (!data) throw new Error("Encrypted data is missing");
    this.data = data;
    if (!iv) throw new Error("IV is missing");
    this.iv = iv;
    if (!mac) throw new Error("HMAC signature is missing");
    this.mac = mac;
  }

  get encryptedString() {
    return `${this.encryptionType}.${[this.data, this.iv, this.mac].join("|")}`;
  }

  toEncryptedObject(key: SymmetricCryptoKey): EncryptedObject {
    return new EncryptedObject({
      data: fromB64ToArray(this.data),
      iv: fromB64ToArray(this.iv),
      mac: fromB64ToArray(this.mac),
      key,
    });
  }
}
