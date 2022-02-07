import * as library from "./";

describe("Exports all expected classes", () => {
  it("should export XDeFiAdapter", () => {
    expect(library.XDeFiAdapter.name).toBe("XDeFiAdapter");
  });

  it("should export XDeFiHDWallet", () => {
    expect(library.XDeFiHDWallet.name).toBe("XDeFiHDWallet");
  });
});
