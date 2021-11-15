import { IArgon2Options } from "hash-wasm";

export type ArgonParams = Pick<IArgon2Options, "parallelism" | "memorySize" | "iterations">;

export type VaultPrepareParams = Partial<{
  machineSeed: CryptoKey;
  defaultArgonParams: ArgonParams;
}>;

export interface IVaultFactory<U extends IVaultBackedBy<any> | IVault> {
  readonly prepare: (params?: VaultPrepareParams) => Promise<void>;
  readonly open: (id?: string) => Promise<U>;
  readonly list: () => Promise<string[]>;
  readonly meta: (id: string) => Promise<Map<string, unknown> | undefined>;
  readonly delete: (id: string) => Promise<void>;
}

export interface IVaultBackedBy<T> {
  readonly id: string;
  readonly argonParams: Readonly<ArgonParams>;
  readonly meta: Map<string, unknown>;
  setPassword(password: string): Promise<void>;
  load(deserialize: (_: T) => Promise<void>): Promise<this>;
  save(serialize: () => Promise<T>): Promise<this>;
}

export interface IVault {
  readonly id: string;
  readonly argonParams: Readonly<ArgonParams>;
  readonly meta: Map<string, unknown>;
  setPassword(password: string): Promise<void>;
  load(): Promise<this>;
  save(): Promise<this>;
}
