import { crypto as btccrypto } from "@bithighlander/bitcoin-cash-js-lib";
import * as ethcrypto from "ethers/lib/utils";

import { AlgorithmName, Algorithm } from "./types";

export const AlgorithmLength = {
    "sha1": 20,
    "ripemd160": 20,
    "hash160": 20,
    "sha256": 32,
    "hash256": 32,
    "keccak256": 32,
    "sha512": 64,
} as const;

export function _initializeAlgorithms(register: <N extends AlgorithmName>(name: N, fn: Algorithm<N>) => void) {
    // Using an "any" return value overrides static type checking of the length of the digest. This
    // is OK because there's no ambiguity as to what it should be and it will be checked at runtime.
    register("sha1", (x): any => btccrypto.sha1(Buffer.from(x)));
    register("ripemd160", (x): any => btccrypto.ripemd160(Buffer.from(x)));
    register("hash160", (x): any => btccrypto.hash160(Buffer.from(x)));
    register("sha256", (x): any => btccrypto.sha256(Buffer.from(x)));
    register("hash256", (x): any => btccrypto.hash256(Buffer.from(x)));
    register("keccak256", (x): any => Buffer.from(ethcrypto.keccak256(x).slice(2), 'hex'));
    register("sha512", (x): any => Buffer.from(ethcrypto.sha512(x).slice(2), 'hex'));
}
