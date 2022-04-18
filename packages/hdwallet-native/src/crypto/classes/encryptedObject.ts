/*
 Copied from portis: packages/portis-crypto/src/models/encryptedObject.ts
 */
import { CipherString } from "./cipherString";
import { SymmetricCryptoKey } from "./symmetricCryptoKey";

export class EncryptedObject {
  key: SymmetricCryptoKey;
  iv: ArrayBuffer;
  data: ArrayBuffer;
  mac: ArrayBuffer;

  constructor({
    key,
    iv,
    data,
    mac,
  }: {
    key: SymmetricCryptoKey;
    iv: ArrayBuffer;
    data: ArrayBuffer;
    mac: ArrayBuffer;
  }) {
    this.key = key;
    this.iv = iv;
    this.data = data;
    this.mac = mac;
  }

  toString() {
    return new CipherString(this).encryptedString;
  }
}
