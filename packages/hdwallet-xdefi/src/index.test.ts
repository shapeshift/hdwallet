import * as library from "./";

describe("Exports all expected classes", () => {
  it("should export XDEFIAdapter", () => {
    expect(library.XDEFIAdapter.name).toBe("XDEFIAdapter");
  });

  it("should export XDEFIHDWallet", () => {
    expect(library.XDEFIHDWallet.name).toBe("XDEFIHDWallet");
  });
});
