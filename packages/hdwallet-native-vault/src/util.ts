import * as core from "@shapeshiftoss/hdwallet-core";
import * as bip39 from "bip39";
import * as uuid from "uuid";
import { TextDecoder, TextEncoder } from "web-encoding";
import { fromAsyncIterable, IAsyncMap } from "./asyncMap";

import { AsyncCrypto } from "./types";

export const nativeEngines = (async () => {
  return (await import("@shapeshiftoss/hdwallet-native")).crypto.Isolation.Engines
})()

export async function createMnemonic(mnemonic: string) {
  return (await nativeEngines).Default.BIP39.Mnemonic.create(mnemonic)
}
export const entropyToMnemonic = bip39.entropyToMnemonic.bind(bip39);

let cryptoResolver: ((x: AsyncCrypto) => void) | undefined
export function setCrypto(x: AsyncCrypto) {
  if (!x) throw new Error("crypto module is required");
  if (!cryptoResolver) throw new Error("can only set crypto module once");
  cryptoResolver(x)
  cryptoResolver = undefined
}
export const crypto = new Promise<AsyncCrypto>(resolve => cryptoResolver = resolve)

let performanceResolver: ((x: Performance) => void) | undefined
export function setPerformance(x: Performance) {
  if (!x) throw new Error("performance module is required");
  if (!performanceResolver) throw new Error("can only set performance module once");
  performanceResolver(x)
  performanceResolver = undefined
}
export const performance = new Promise<Performance>(resolve => performanceResolver = resolve)

export const uuidNamespace = uuid.v5("hdwallet-native-vault", uuid.NIL);
export const keyStoreUUID = uuid.v5("keyStore", uuidNamespace);
export const vaultStoreUUID = uuid.v5("vaultStore", uuidNamespace);
// export const GENERATE_MNEMONIC = uuid.v5("GENERATE_MNEMONIC", uuidNamespace);
export const GENERATE_MNEMONIC = uuid.v4();

export const decoder = new TextDecoder();
export const encoder = new TextEncoder();

export function shadowedAsyncMap<K, V, T extends IAsyncMap<K, V>>(map: T, get: (this: T, key: K) => Promise<undefined | V>, addRevoker: (x: () => void) => void): T {
  return core.overlay(map, {
    get,
    async values(this: T) {
      return await Promise.all((await fromAsyncIterable(await this.keys())).map(async k => await get.call(this, k)))
    },
    async entries(this: T) {
      return await Promise.all((await fromAsyncIterable(await this.keys())).map(async k => [k, await get.call(this, k)]))
    }
  } as object, { addRevoker, bind: "lower" as const })
}
