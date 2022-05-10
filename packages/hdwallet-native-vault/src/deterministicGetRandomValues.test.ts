import { AsyncCrypto } from "./types";

// (This is also used in index.test.ts)
// eslint-disable-next-line jest/no-export
export async function deterministicGetRandomValues(crypto: AsyncCrypto, seed: Uint8Array = new Uint8Array(32)) {
  const rngSeed = await crypto.subtle.importKey(
    "raw",
    seed,
    {
      name: "HKDF",
    },
    false,
    ["deriveBits"]
  );
  const rngCounter = new Uint32Array(1);

  return async function getRandomValues<T extends ArrayBufferView | null>(array: T): Promise<T> {
    rngCounter[0]++;
    if (array === null) return array;
    const arrayBuf = Buffer.from(array.buffer, array.byteOffset, array.byteLength);
    const randomBuf = Buffer.from(
      await crypto.subtle.deriveBits(
        {
          name: "HKDF",
          hash: "SHA-256",
          salt: new Uint8Array(),
          info: rngCounter,
        },
        rngSeed,
        array.byteLength * 8
      )
    );
    if (arrayBuf.byteLength !== randomBuf.byteLength) throw new Error("rng length mismatch");
    arrayBuf.fill(randomBuf);
    return array;
  };
}

describe("deterministicGetRandomValues", () => {
  it("should return deterministic values", async () => {
    const getRandomValues = await deterministicGetRandomValues(require("crypto").webcrypto as Crypto);
    expect(await (await getRandomValues(Buffer.alloc(16))).toString("hex")).toMatchInlineSnapshot(
      `"8f9c0a54715732f707f1361325aaf80a"`
    );
    expect(await (await getRandomValues(Buffer.alloc(16))).toString("hex")).toMatchInlineSnapshot(
      `"6e62a809bbbbb97532704ba8e607fa4f"`
    );
    expect(await (await getRandomValues(Buffer.alloc(16))).toString("hex")).toMatchInlineSnapshot(
      `"5f22ec6a1e7d693101db8dfcc6333434"`
    );
    expect(await (await getRandomValues(Buffer.alloc(32))).toString("hex")).toMatchInlineSnapshot(
      `"2e9a42cbe2c0e8922623c9d54617df2a7632fa893092a8c2f9c2ed0ac6254500"`
    );
    expect(await (await getRandomValues(Buffer.alloc(32))).toString("hex")).toMatchInlineSnapshot(
      `"d074ce162d9fc9b98881ec2367381056ecaac7a2445c9c981b3a3500175460b6"`
    );
    expect(await (await getRandomValues(Buffer.alloc(32))).toString("hex")).toMatchInlineSnapshot(
      `"42db59172fe5e5dda7afaebc3f1cd8e41bf38a40c77fa45e3aa1cc11f83e0335"`
    );
  });
});
