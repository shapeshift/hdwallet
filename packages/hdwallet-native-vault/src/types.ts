import type * as core from "@shapeshiftoss/hdwallet-core"
import type { IArgon2Options } from "hash-wasm";
import type * as idb from "idb-keyval";

import type { IAsyncMap } from "./asyncMap";

export type AsyncCrypto = Omit<Crypto, "getRandomValues"> & {
  getRandomValues<T extends DataView | Float32Array | Float64Array | Uint8ClampedArray | Uint8Array | Int8Array | Int16Array | Int32Array | Uint16Array | Uint32Array | null>(array: T): T | Promise<T>;
}

export type ArgonParams = Pick<IArgon2Options, "parallelism" | "memorySize" | "iterations">;

export type VaultPrepareParams = Partial<{
  crypto: AsyncCrypto;
  performance: Performance;
  keyStore: idb.UseStore;
  vaultStore: idb.UseStore;
}>;

export interface IVaultFactory<U extends IVaultBackedBy<any> | IVault> {
  readonly prepare: (params?: VaultPrepareParams) => Promise<void>;
  readonly create: (password?: string) => Promise<U>;
  readonly open: (id?: string, password?: string) => Promise<U>;
  readonly list: () => Promise<AsyncIterable<string>>;
  readonly meta: (id: string) => Promise<IAsyncMap<string, unknown> | undefined>;
  readonly delete: (id: string) => Promise<void>;
}

export interface ISealableVaultFactory<U extends ISealable & (IVaultBackedBy<any> | IVault)> extends IVaultFactory<U> {
  readonly create: (password?: string, sealed?: boolean) => Promise<U>;
  readonly open: (id?: string, password?: string, sealed?: boolean) => Promise<U>;
}

export interface IVaultBackedBy<T> {
  readonly id: Promise<string>;
  readonly meta: Promise<IAsyncMap<string, unknown>>;
  setPassword(password: string): Promise<void>;
  load(deserialize: (_: T) => Promise<void>): Promise<void>;
  save(serialize: () => Promise<T>): Promise<void>;
}

export interface ISealable extends core.Revocable {
  readonly sealed: Promise<boolean>;
  seal(): Promise<void>;
  unwrap(addRevoker?: (revoke: () => void) => void): Promise<this>;
}

export interface IVault extends IAsyncMap<string, unknown>, ISealable, core.Revocable {
  readonly id: Promise<string>;
  readonly meta: Promise<IAsyncMap<string, unknown>>;
  setPassword(password: string): Promise<void>;
  load(): Promise<void>;
  save(): Promise<void>;
}
