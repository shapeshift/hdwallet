/*
 Copied from portis: packages/portis-crypto/src/models/symmetricCryptoKey.ts
 */
import { fromBufferToB64 } from "../utils";
import { EncryptionType } from "./encryptionType";

export class SymmetricCryptoKey {
  hashKey: ArrayBuffer;
  encKey: ArrayBuffer;
  macKey: ArrayBuffer | null;
  encType: EncryptionType = EncryptionType.AesCbc256_HmacSha256_B64;

  hashKeyB64: string;
  encKeyB64: string;
  macKeyB64: string;

  constructor(hashKey: ArrayBuffer, encKey: ArrayBuffer, mac: ArrayBuffer) {
    if (hashKey == null) throw new Error("Required parameter [hashKey] was not provided");
    if (encKey == null) throw new Error("Required parameter [encKey] was not provided");
    if (mac == null) throw new Error("Required parameter [mac] was not provided");

    if (hashKey.byteLength !== 32 || encKey.byteLength !== 32 || mac.byteLength !== 32)
      throw new Error("Keys must be 32 bytes");

    this.hashKey = hashKey;
    this.encKey = encKey;
    this.macKey = mac;

    this.hashKeyB64 = fromBufferToB64(this.hashKey);
    this.encKeyB64 = fromBufferToB64(this.encKey);
    this.macKeyB64 = fromBufferToB64(this.macKey);
  }
}
