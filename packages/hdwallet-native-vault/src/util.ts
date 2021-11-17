import * as native from "@shapeshiftoss/hdwallet-native";
import * as uuid from "uuid";
import { TextDecoder, TextEncoder } from "web-encoding";

import { AsyncCrypto } from "./types";

let cryptoResovler: ((x: AsyncCrypto) => void) | undefined
export function setCrypto(x: AsyncCrypto) {
  if (!x) throw new Error("crypto module is required");
  if (!cryptoResovler) throw new Error("can only set crypto module once");
  cryptoResovler(x)
  cryptoResovler = undefined
}
export const crypto = new Promise<AsyncCrypto>(resolve => cryptoResovler = resolve)

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

export const Revocable = native.crypto.Isolation.Engines.Default.Revocable;
export const revocable = native.crypto.Isolation.Engines.Default.revocable;
export const decoder = new TextDecoder();
export const encoder = new TextEncoder();
