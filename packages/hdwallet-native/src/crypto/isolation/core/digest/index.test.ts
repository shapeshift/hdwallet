import { Algorithms } from ".";
import { fromWordArray, toWordArray } from "./algorithms";

describe("Digests", () => {
  it("converts to/from WordArrays correctly", () => {
    const inHex = "deadbeeffeedface";
    const input = Buffer.from(inHex, "hex");
    const foo = toWordArray(input);
    const bar = fromWordArray(foo);
    const output = Buffer.from(bar);
    expect(output.toString("hex")).toEqual(inHex);
  });
  it.each([
    ["SHA-1", "sha1", "616263", "a9993e364706816aba3e25717850c26c9cd0d89d"],
    ["RIPEMD160", "ripemd160", "616263", "8eb208f7e05d987a9b044a8e98c6b087f15a0bfc"],
    ["HASH160", "hash160", "616263", "bb1be98c142444d7a56aa3981c3942a978e4dc33"],
    ["SHA-256", "sha256", "616263", "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"],
    ["HASH256", "hash256", "616263", "4f8b42c22dd3729b519ba6f68d2da7cc5b2d606d05daed5ad5128cc03e6c6358"],
    ["Keccak-256", "keccak256", "616263", "4e03657aea45a94fc7d47ba826c8d667c0d1e6e33a64a036ec44f58fa12d6c45"],
    [
      "SHA-512",
      "sha512",
      "616263",
      "ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f",
    ],
  ] as const)("correctly implements %s", (_, algName, inHex, outHex) => {
    const input = Buffer.from(inHex, "hex");
    console.time(algName);
    const output = (() => {
      for (let i = 0; ; i++) {
        const foo = Algorithms[algName](input);
        if (i === 1000) return foo;
      }
    })();
    console.timeEnd(algName);
    expect(output.preimage).toEqual(input);
    expect(Buffer.from(output).toString("hex")).toEqual(outHex);
  });
});
