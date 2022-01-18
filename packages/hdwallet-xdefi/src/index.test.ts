import * as library from "./";

describe("Exports all expected classes", () => {
  it("should export EncryptedWallet", () => {
    expect(library.XDeFiAdapter.name).toBe("XDeFiAdapter");
  });

  it("should export WebCryptoEngine", () => {
    expect(library.XDeFiHDWallet.name).toBe("XDeFiHDWallet");
  });
});
