import * as library from "./";

describe("Exports all expected classes", () => {
  it("should export TallyAdapter", () => {
    expect(library.TallyAdapter.name).toBe("TallyAdapter");
  });

  it("should export XDeFiHDWallet", () => {
    expect(library.TallyHDWallet.name).toBe("TallyHDWallet");
  });
});
