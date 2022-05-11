import * as library from "./";

describe("Exports all expected classes", () => {
  it("should export TallyHoAdapter", () => {
    expect(library.TallyHoAdapter.name).toBe("TallyHoAdapter");
  });

  it("should export XDeFiHDWallet", () => {
    expect(library.TallyHoHDWallet.name).toBe("TallyHoHDWallet");
  });
});
