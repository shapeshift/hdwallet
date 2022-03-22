import CryptoJS from "crypto-js";

import { Algorithm, AlgorithmName } from "./types";

export const AlgorithmLength = {
  sha1: 20,
  ripemd160: 20,
  hash160: 20,
  sha256: 32,
  hash256: 32,
  keccak256: 32,
  sha512: 64,
} as const;

export function toWordArray(x: Uint8Array): CryptoJS.lib.WordArray {
  // TODO: avoid this conversion
  return CryptoJS.enc.Hex.parse(Buffer.from(x).toString("hex"));
  // return (CryptoJS.lib.WordArray.create as unknown as (x: Uint8Array) => CryptoJS.lib.WordArray)(x);
}

export function fromWordArray(x: CryptoJS.lib.WordArray): Uint8Array {
  // TODO: avoid this conversion
  return Buffer.from(CryptoJS.enc.Hex.stringify(x), "hex");
  // return Buffer.alloc(x.sigBytes).map((_, i) => (x.words[i >>> 2] >>> (32 - (((i + 1) & 0x03) << 3))) & 0xff);
}

export function _initializeAlgorithms(register: <N extends AlgorithmName>(name: N, fn: Algorithm<N>) => void) {
  // Using an "any" return value overrides static type checking of the length of the digest. This
  // is OK because there's no ambiguity as to what it should be and it will be checked at runtime.

  try {
    // (Can't use a dynamic import here, because the return is needed synchronously; can't use a static import,
    // because we need to fall back tp CryptoJS in browsers)
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const crypto = require("crypto");
    register("sha1", (x): any => crypto.createHash("sha1").update(x).digest());
    register("ripemd160", (x): any => crypto.createHash("ripemd160").update(x).digest());
    register("hash160", (x): any =>
      crypto.createHash("ripemd160").update(crypto.createHash("sha256").update(x).digest()).digest()
    );
    register("sha256", (x): any => crypto.createHash("sha256").update(x).digest());
    register("hash256", (x): any =>
      crypto.createHash("sha256").update(crypto.createHash("sha256").update(x).digest()).digest()
    );
    // register("keccak256", (x): any => crypto.createHash("sha3-256").update(x).digest());
    register("keccak256", (x): any => fromWordArray(CryptoJS.SHA3(toWordArray(x), { outputLength: 256 })));
    register("sha512", (x): any => crypto.createHash("sha512").update(x).digest());
  } catch {
    register("sha1", (x): any => fromWordArray(CryptoJS.SHA1(toWordArray(x))));
    register("ripemd160", (x): any => fromWordArray(CryptoJS.RIPEMD160(toWordArray(x))));
    register("hash160", (x): any => fromWordArray(CryptoJS.RIPEMD160(CryptoJS.SHA256(toWordArray(x)))));
    register("sha256", (x): any => fromWordArray(CryptoJS.SHA256(toWordArray(x))));
    register("hash256", (x): any => fromWordArray(CryptoJS.SHA256(CryptoJS.SHA256(toWordArray(x)))));
    register("keccak256", (x): any => fromWordArray(CryptoJS.SHA3(toWordArray(x), { outputLength: 256 })));
    register("sha512", (x): any => fromWordArray(CryptoJS.SHA512(toWordArray(x))));
  }
}
