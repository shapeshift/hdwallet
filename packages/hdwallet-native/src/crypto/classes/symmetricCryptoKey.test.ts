import { EncryptionType } from "./encryptionType";
import { SymmetricCryptoKey } from "./symmetricCryptoKey";

describe("symmetricCryptoKey", () => {
  const key = new Uint8Array(32).fill(64);
  const encKey = new Uint8Array(32).fill(128);
  const macKey = new Uint8Array(32).fill(255);
  const key64 = new Uint8Array(64);
  key64.set(encKey, 0);
  key64.set(macKey, 32);

  it.each([
    ["key", []],
    ["encKey", [encKey]],
    ["macKey", [encKey, encKey]],
  ])("should require a parameter %s", (name: string, params: ArrayBuffer[]) => {
    expect(() => new (SymmetricCryptoKey as any)(...params)).toThrow("Required parameter");
  });

  it.each([
    ["key", [key64, encKey, macKey]],
    ["encKey", [key, key64, macKey]],
    ["macKey", [key, encKey, key64]],
  ])("should throw an error if %s is not 32 bytes", (name: string, params: ArrayBuffer[]) => {
    expect(() => new (SymmetricCryptoKey as any)(...params)).toThrow("Keys must be 32 bytes");
  });

  it("should return an instance", () => {
    const instance = new SymmetricCryptoKey(key, encKey, macKey);
    expect(instance.hashKey).toEqual(key);
    expect(instance.encKey).toEqual(encKey);
    expect(instance.macKey).toEqual(macKey);
    expect(instance.encType).toBe(EncryptionType.AesCbc256_HmacSha256_B64);
  });

  it("should provide keys in base64 format", () => {
    const instance = new SymmetricCryptoKey(key, encKey, macKey);
    expect(instance.hashKeyB64).toEqual("QEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEA=");
    expect(instance.encKeyB64).toEqual("gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIA=");
    expect(instance.macKeyB64).toEqual("//////////////////////////////////////////8=");
    expect(instance.encType).toBe(EncryptionType.AesCbc256_HmacSha256_B64);
  });
});
