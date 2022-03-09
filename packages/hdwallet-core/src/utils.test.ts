import {
  bip32Like,
  bip32ToAddressNList,
  fromHexString,
  isArray,
  satsFromStr,
  slip44ByCoin,
  stripHexPrefix,
  toHexString,
} from "./utils";

describe("isArray", () => {
  it("recognizes arrays", () => {
    expect(isArray([])).toBeTruthy();
    expect(isArray("")).toBeFalsy();
  });
});

describe("toHexString", () => {
  test.each(["", "123456", "abcdef"])('toHexString(fromHexString("%s")) == "%s"', (str) => {
    expect(toHexString(fromHexString(str))).toEqual(str);
  });
});

describe("bip32ToAddressNList", () => {
  it("converts bitcoin paths correctly", () => {
    expect(bip32ToAddressNList("m/44'/0'/3'/0/0")).toEqual([0x80000000 + 44, 0x80000000 + 0, 0x80000000 + 3, 0, 0]);
    expect(bip32ToAddressNList("m/44'/0'/3'/0/1")).toEqual([0x80000000 + 44, 0x80000000 + 0, 0x80000000 + 3, 0, 1]);
    expect(bip32ToAddressNList("m/44'/0'/3'/1/1")).toEqual([0x80000000 + 44, 0x80000000 + 0, 0x80000000 + 3, 1, 1]);
    expect(bip32ToAddressNList("m/44h/0h/3h/0/0")).toEqual([0x80000000 + 44, 0x80000000 + 0, 0x80000000 + 3, 0, 0]);
    expect(bip32ToAddressNList("m/44H/0H/3H/0/0")).toEqual([0x80000000 + 44, 0x80000000 + 0, 0x80000000 + 3, 0, 0]);
    expect(bip32ToAddressNList("m/")).toEqual([]);
  });

  it.each(["///", "m/2147483692'/0'/0'/0/0", "ceci n'est pas une bip32 path"])(
    "to throw on invalid input: '%s'",
    (str) => {
      expect(() => {
        bip32ToAddressNList(str);
      }).toThrow();
    }
  );
});

describe("stripHexPrefix", () => {
  describe.each([
    ["0x", ""],
    ["12345", "12345"],
    ["", ""],
  ])('stripHexPrefix("%s")', (a, expected) => {
    it(`returns '${expected}'`, () => {
      expect(stripHexPrefix(a)).toEqual(expected);
    });
  });
});

describe("bip32Like", () => {
  describe.each([
    ["m/", true],
    ["m/44/0/0", true],
    ["m/44h/60h/32h/0/0", true],
    ["m/44H/1H", true],
    ["m/44h/1h", true],
    ["m/44'/1'", true],
    ["", false], // no m/
    ["m/44h/0/0h", false], // hardening must come first
    ["m/44/0/0h", false], // hardening must come first
    ["m/44h/60H/32'/0/0", false], // must mot mix hardening syntax
    ["m/44H/1h", false], // must mot mix hardening syntax
    ["m/44H/1'", false], // must mot mix hardening syntax
    ["m/44h/1'", false], // must mot mix hardening syntax
  ])('bip32Like("%s")', (a: string, expected: boolean) => {
    it(`returns ${expected}`, () => {
      expect(bip32Like(a)).toEqual(expected);
    });
  });
});

describe("slip44ByCoin", () => {
  it("passes basic smoke tests", () => {
    expect(slip44ByCoin("Bitcoin")).toEqual(0);
    expect(slip44ByCoin("Litecoin")).toEqual(2);
  });
});

describe("satsFromStr", () => {
  it("converts correctly", () => {
    expect(satsFromStr("0.00000001")).toEqual(1);
    expect(satsFromStr("0.0000001")).toEqual(10);
    expect(satsFromStr("0.000001")).toEqual(100);
    expect(satsFromStr("0.00001")).toEqual(1000);
    expect(satsFromStr("0.0001")).toEqual(10000);
    expect(satsFromStr("0.001")).toEqual(100000);
    expect(satsFromStr("0.01")).toEqual(1000000);
    expect(satsFromStr("0.1")).toEqual(10000000);
    expect(satsFromStr("1")).toEqual(100000000);
    expect(satsFromStr("0.00000001")).toEqual(1);
    expect(satsFromStr("0.00000010")).toEqual(10);
    expect(satsFromStr("0.00000100")).toEqual(100);
    expect(satsFromStr("0.00001000")).toEqual(1000);
    expect(satsFromStr("0.00010000")).toEqual(10000);
    expect(satsFromStr("0.00100000")).toEqual(100000);
    expect(satsFromStr("0.01000000")).toEqual(1000000);
    expect(satsFromStr("0.10000000")).toEqual(10000000);
    expect(satsFromStr("1")).toEqual(100000000);
    expect(satsFromStr("10")).toEqual(1000000000);
    expect(satsFromStr("100")).toEqual(10000000000);
    expect(satsFromStr("1000")).toEqual(100000000000);
    expect(satsFromStr("10000")).toEqual(1000000000000);
    expect(satsFromStr("100000")).toEqual(10000000000000);
    expect(satsFromStr("1000000")).toEqual(100000000000000);
    expect(satsFromStr("21000000")).toEqual(2100000000000000);

    expect(satsFromStr("12345678.90123456")).toEqual(1234567890123456);
  });
});
