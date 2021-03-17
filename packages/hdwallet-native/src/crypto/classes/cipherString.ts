/*
 Copied from portis: packages/portis-crypto/src/models/cipherString.ts
 */
import { fromBufferToB64, fromB64ToArray } from "../utils";
import { EncryptedObject } from "./encryptedObject";
import { EncryptionType } from "./encryptionType";
import { SymmetricCryptoKey } from "./symmetricCryptoKey";

export class CipherString {
  readonly encryptionType: EncryptionType = EncryptionType.AesCbc256_HmacSha256_B64;
  data: string;
  iv: string;
  mac: string;

  constructor(cipher: string | EncryptedObject) {
    if (typeof cipher === "string") {
      try {
        const header = cipher.split(".");
        this.encryptionType = Number(header[0]);
        [this.data, this.iv, this.mac] = header[1].split("|");
      } catch (e) {
        throw new Error("Invalid cipher string");
      }
    } else if (cipher instanceof EncryptedObject) {
      try {
        this.encryptionType = cipher.key.encType;
        this.iv = fromBufferToB64(cipher.iv);
        this.data = fromBufferToB64(cipher.data);
        if (cipher.mac) this.mac = fromBufferToB64(cipher.mac);
      } catch (e) {
        throw new Error("Invalid encryption object");
      }
    } else {
      throw new Error("Invalid cipher data. You must provide a string or Encrypted Object");
    }

    if (!EncryptionType[this.encryptionType]) {
      throw new Error("Unsupported encryption method");
    }
    if (!this.data) throw new Error("Encrypted data is missing");
    if (!this.iv) throw new Error("IV is missing");
    if (!this.mac) throw new Error("HMAC signature is missing");
  }

  get encryptedString() {
    return `${this.encryptionType}.${[this.data, this.iv, this.mac].join("|")}`;
  }

  toEncryptedObject(key: SymmetricCryptoKey): EncryptedObject {
    return Object.assign(new EncryptedObject(), {
      data: fromB64ToArray(this.data),
      iv: fromB64ToArray(this.iv),
      mac: fromB64ToArray(this.mac),
      key,
    })
  }
}
