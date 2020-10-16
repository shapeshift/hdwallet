/*
 Copied from portis: packages/portis-crypto/src/models/encryptedObject.ts
 */
import { CipherString } from "./cipherString";
import { SymmetricCryptoKey } from "./symmetricCryptoKey";

export class EncryptedObject {
  iv: ArrayBuffer;
  data: ArrayBuffer;
  mac: ArrayBuffer;
  key: SymmetricCryptoKey;

  toString() {
    return new CipherString(this).encryptedString;
  }
}
