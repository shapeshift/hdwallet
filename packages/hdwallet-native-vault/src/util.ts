import * as native from "@shapeshiftoss/hdwallet-native";
import * as idb from "idb-keyval";
import * as uuid from "uuid";

export const crypto = typeof window !== "undefined" && "crypto" in window ? window.crypto : require("crypto").webcrypto;
export const performance =
  typeof window !== "undefined" && "performance" in window
    ? window.performance
    : (require("perf_hooks").performance as globalThis.Performance);

export const uuidNamespace = uuid.v5("hdwallet-native-vault", uuid.NIL);
export const keyStore = idb.createStore(uuid.v5("keyStore", uuidNamespace), "keyval");
export const vaultStore = idb.createStore(uuid.v5("vaultStore", uuidNamespace), "keyval");

export const Revocable = native.crypto.Isolation.Engines.Default.Revocable;
export const revocable = native.crypto.Isolation.Engines.Default.revocable;
export const decoder = new TextDecoder();
export const encoder = new TextEncoder();
