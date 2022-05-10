import * as native from "@shapeshiftoss/hdwallet-native";
import * as bip39 from "bip39";
import PLazy from "p-lazy";
import * as uuid from "uuid";
import { TextDecoder, TextEncoder } from "web-encoding";

import { AsyncCrypto } from "./types";

const nativeEngines = PLazy.from(async () => {
  return (await import("@shapeshiftoss/hdwallet-native")).crypto.Isolation.Engines;
});

export async function createMnemonic(mnemonic: string) {
  return (await nativeEngines).Default.BIP39.Mnemonic.create(mnemonic);
}
export const entropyToMnemonic = bip39.entropyToMnemonic.bind(bip39);

let cryptoResolver: ((x: AsyncCrypto) => void) | undefined;

export function setCrypto(x: AsyncCrypto) {
  if (!x) throw new Error("crypto module is required");
  if (!cryptoResolver) throw new Error("can only set crypto module once");
  cryptoResolver(x);
  cryptoResolver = undefined;
}
export const crypto = new Promise<AsyncCrypto>((resolve) => (cryptoResolver = resolve));

let performanceResolver: ((x: Performance) => void) | undefined;
export function setPerformance(x: Performance) {
  if (!x) throw new Error("performance module is required");
  if (!performanceResolver) throw new Error("can only set performance module once");
  performanceResolver(x);
  performanceResolver = undefined;
}
export const performance = new Promise<Performance>((resolve) => (performanceResolver = resolve));

export const uuidNamespace = uuid.v5("hdwallet-native-vault", uuid.NIL);
export const keyStoreUUID = uuid.v5("keyStore", uuidNamespace);
export const vaultStoreUUID = uuid.v5("vaultStore", uuidNamespace);
// Using a dynamic v4 UUID for GENERATE_MNEMONIC is slightly more correct and secure, but it could also be a v5 UUID:
// export const GENERATE_MNEMONIC = uuid.v5("GENERATE_MNEMONIC", uuidNamespace);
export const GENERATE_MNEMONIC = uuid.v4();

export type Revocable = native.crypto.Isolation.Engines.Default.Revocable;
export const Revocable = native.crypto.Isolation.Engines.Default.Revocable;
export const revocable = native.crypto.Isolation.Engines.Default.revocable;
export const decoder = new TextDecoder();
export const encoder = new TextEncoder();

export function shadowedMap<K, V, T extends Map<K, V>>(
  map: T,
  get: (key: K) => undefined | V,
  addRevoker: (revoke: () => void) => void
): T {
  const self = map;
  const { proxy, revoke } = Proxy.revocable(self, {
    get(t, p, r) {
      switch (p) {
        case "get":
          return get.bind(self);
        case "values":
          return () => Array.from(self.keys()).map((k) => get(k));
        case "entries":
          return () => Array.from(self.keys()).map((k) => [k, get(k)]);
        case "entriesAsync":
          return () => Promise.all(Array.from(self.keys()).map(async (k) => [k, await get(k)]));
        case "forEach":
          return (callbackFn: (v?: V, k?: K, m?: typeof self) => void, thisArg?: object) => {
            for (const key of self.keys()) {
              callbackFn.call(thisArg, get(key), key, self);
            }
          };
        default: {
          const out = Reflect.get(t, p, r);
          // if (!String(p).startsWith("_") && typeof out === "function") return out.bind(t);
          return out;
        }
      }
    },
  });
  addRevoker(revoke);
  return proxy;
}
