/*
 Copied from portis: packages/portis-crypto/src/models/encryptedObject.ts
 */
import { SymmetricCryptoKey } from "./symmetricCryptoKey";

export class EncryptedObject {
  iv: ArrayBuffer;
  data: ArrayBuffer;
  mac?: ArrayBuffer;
  key: SymmetricCryptoKey;
}
