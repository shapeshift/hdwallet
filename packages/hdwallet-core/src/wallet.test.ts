import { HDWallet, infoBTC, infoETH, supportsBTC, supportsDebugLink, supportsETH } from "./wallet";

describe("wallet : guards", () => {
  it.each([infoBTC, infoETH, supportsBTC, supportsETH, supportsDebugLink])(
    "should return falsy for `null`",
    (method) => {
      expect(method(undefined as any)).toBeFalsy();
      expect(method(null as any)).toBeFalsy();
      expect(method({} as any)).toBeFalsy();
    }
  );

  it("infoBTC should be truthy", () => expect(infoBTC({ _supportsBTCInfo: true } as unknown as HDWallet)).toBeTruthy());
  it("infoETH should be truthy", () => expect(infoETH({ _supportsETHInfo: true } as unknown as HDWallet)).toBeTruthy());
  it("supportsBTC should be truthy", () =>
    expect(supportsBTC({ _supportsBTC: true } as unknown as HDWallet)).toBeTruthy());
  it("supportsETH should be truthy", () =>
    expect(supportsETH({ _supportsETH: true } as unknown as HDWallet)).toBeTruthy());
  it("supportsDebugLink should be truthy", () =>
    expect(supportsDebugLink({ _supportsDebugLink: true } as unknown as HDWallet)).toBeTruthy());
});
