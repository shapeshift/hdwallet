import { EncryptionType } from "./encryptionType";
import { SymmetricCryptoKey } from "./symmetricCryptoKey";

describe("symmetricCryptoKey", () => {
  const key32 = new Uint8Array(32).fill(128);
  const keyMac = new Uint8Array(32).fill(255);
  const key64 = new Uint8Array(64);
  key64.set(key32, 0);
  key64.set(keyMac, 32);

  it("should require an encryption key", () => {
    // @ts-ignore
    expect(() => new SymmetricCryptoKey()).toThrow("Must provide key");
  });

  it("should infer encryption type for a 32-bit key", () => {
    const key = new SymmetricCryptoKey(key32);
    expect(key.key).toEqual(key.encKey);
    expect(key.macKey).toBeNull();
    expect(key.encType).toBe(EncryptionType.AesCbc256_B64);
  });

  it("should infer encryption type for a 64-bit key", () => {
    const key = new SymmetricCryptoKey(key64);
    expect(key.key).toEqual(key64);
    expect(key.encKey).toEqual(key32);
    expect(key.macKey).toEqual(keyMac);
    expect(key.encType).toBe(EncryptionType.AesCbc256_HmacSha256_B64);
  });

  it("should support EncryptionType.AesCbc128_HmacSha256_B64", () => {
    expect(new SymmetricCryptoKey(key32, EncryptionType.AesCbc128_HmacSha256_B64).encType).toEqual(
      EncryptionType.AesCbc128_HmacSha256_B64
    );
  });

  it("should provide key in base64 format", () => {
    const key = new SymmetricCryptoKey(key64);
    expect(key.keyB64).toEqual(
      "gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgID//////////////////////////////////////////w=="
    );
    expect(key.encKeyB64).toEqual("gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIA=");
    expect(key.macKeyB64).toEqual("//////////////////////////////////////////8=");
    expect(key.encType).toBe(EncryptionType.AesCbc256_HmacSha256_B64);
  });

  it.each([
    [EncryptionType.AesCbc256_HmacSha256_B64, key32],
    [EncryptionType.AesCbc256_B64, key64],
    [EncryptionType.AesCbc128_HmacSha256_B64, key64],
  ])("should require the key be correct length for EncryptionType %i", (type: EncryptionType, key: ArrayBuffer) => {
    expect(() => new SymmetricCryptoKey(key, type)).toThrow("Unsupported encType/key length.");
  });

  it("should throw an error if the EncryptionType cannot be inferred", () => {
    expect(() => new SymmetricCryptoKey(new Uint8Array(16))).toThrow("Unable to determine encType.");
  });
});
