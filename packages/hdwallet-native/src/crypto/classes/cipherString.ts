/*
 Copied from portis: packages/portis-crypto/src/models/cipherString.ts
 */
import * as utils from "../utils";
import { EncryptedObject } from "./encryptedObject";
import { EncryptionType } from "./encryptionType";

export class CipherString {
  encryptionType: EncryptionType;
  data: string;
  iv: string;
  mac?: string;

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
        this.iv = utils.fromBufferToB64(cipher.iv);
        this.data = utils.fromBufferToB64(cipher.data);
        if (cipher.mac) this.mac = utils.fromBufferToB64(cipher.mac);
      } catch (e) {
        throw new Error("Invalid encryption object");
      }
    } else {
      throw new Error("Invalid cipher data. You must provide a string or Encrypted Object");
    }

    switch (this.encryptionType) {
      case EncryptionType.AesCbc128_HmacSha256_B64:
      case EncryptionType.AesCbc256_HmacSha256_B64:
        if (!this.mac) throw new Error("MAC required for encryption type.");
        break;
      case EncryptionType.AesCbc256_B64:
        if (!this.iv) throw new Error("IV required for encryption type.");
        break;
      case EncryptionType.Rsa2048_OaepSha256_B64:
      case EncryptionType.Rsa2048_OaepSha1_B64:
        if (!this.data) throw new Error("Data required for encryption type");
        break;
      default:
        return;
    }
  }

  get encryptedString() {
    return `${this.encryptionType}.${[this.data, this.iv, this.mac || ""].join("|")}`;
  }
}
