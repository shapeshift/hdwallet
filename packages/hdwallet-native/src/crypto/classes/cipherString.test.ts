import { CipherString, EncryptedObject, EncryptionType, SymmetricCryptoKey } from ".";

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
    const buffer32 = new Uint8Array(32).fill(0);
    const buffer16 = new Uint8Array(16).fill(0);
    const encrypted = new EncryptedObject();
    encrypted.data = buffer32;
    encrypted.iv = buffer16;
    encrypted.mac = buffer32;
    encrypted.key = new SymmetricCryptoKey(buffer32, buffer32, buffer32);
    const string = new CipherString(encrypted);

    expect(string.encryptionType).toEqual(EncryptionType.AesCbc256_HmacSha256_B64);
    expect(string.data).toEqual("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=");
    expect(string.iv).toEqual("AAAAAAAAAAAAAAAAAAAAAA==");
    expect(string.mac).toEqual("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=");
    expect(string.encryptedString).toEqual(
      "2.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=|AAAAAAAAAAAAAAAAAAAAAA==|AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="
    );
  });
});
