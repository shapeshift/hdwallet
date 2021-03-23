import * as library from "./";

describe("Exports all expected classes", () => {
  it("should export EncryptedWallet", () => {
    expect(library.crypto.EncryptedWallet.name).toBe("EncryptedWallet");
  });

  it("should export WebCryptoEngine", () => {
    expect(library.crypto.engines.WebCryptoEngine.name).toBe("WebCryptoEngine");
  });
});
