import { CipherString } from "./cipherString";
import { EncryptedObject } from "./encryptedObject";
import { EncryptionType } from "./encryptionType";
import { SymmetricCryptoKey } from "./symmetricCryptoKey";

describe("CipherString", () => {
  it.each([undefined, null, 0, [1, 2, 3], { data: "", iv: "", key: "" }, "", "abc|abc|abc"])(
    "should throw an error if an invalid cipher is provided (%s)",
    (cipher: any) => {
      expect(() => new CipherString(cipher)).toThrow("Invalid cipher");
    }
  );

  it("should accept a properly formatted cipher string", () => {
    const string = new CipherString("2.AAAA|AAAA|AAAA");
    expect(string.encryptionType).toEqual(2);
    expect(string.data).toEqual("AAAA");
    expect(string.iv).toEqual("AAAA");
    expect(string.mac).toEqual("AAAA");
    expect(string.encryptedString).toEqual("2.AAAA|AAAA|AAAA");
  });

  it("should accept an EncryptedObject", () => {
    const encrypted = new EncryptedObject();
    encrypted.data = new Uint8Array(32).fill(0);
    encrypted.iv = new Uint8Array(16).fill(0);
    encrypted.key = new SymmetricCryptoKey(new Uint8Array(32).fill(0), EncryptionType.AesCbc256_B64);
    const string = new CipherString(encrypted);

    expect(string.encryptionType).toEqual(EncryptionType.AesCbc256_B64);
    expect(string.data).toEqual("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=");
    expect(string.iv).toEqual("AAAAAAAAAAAAAAAAAAAAAA==");
    expect(string.mac).toBeUndefined();
    expect(string.encryptedString).toEqual("0.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=|AAAAAAAAAAAAAAAAAAAAAA==|");
  });
});
