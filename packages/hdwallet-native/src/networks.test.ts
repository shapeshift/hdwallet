import { getNetwork } from "./networks";

describe("getNetwork", () => {
  it("should return the bitcoin network", () => {
    expect(getNetwork("bitcoin")).toMatchObject({
      bech32: "bc",
      pubKeyHash: 0x00,
      scriptHash: 0x05,
      wif: 0x80,
    });
  });

  it("should return the testnet network", () => {
    expect(getNetwork("testnet")).toMatchObject({
      bech32: "tb",
      pubKeyHash: 0x6f,
      scriptHash: 0xc4,
      wif: 0xef,
    });
  });

  it("should throw if asked for an unsupported network", () => {
    expect(() => getNetwork("foobar")).toThrowError("foobar network not supported");
  });

  it("should throw if asked for an unsupported script type", () => {
    expect(() => getNetwork("bitcoin", "foobar")).toThrowError("foobar not supported for bitcoin network");
  });
});
