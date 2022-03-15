/* This is intended to be used to test the tests. It should not be shipped or *shudder* actually used. */
import * as core from "@shapeshiftoss/hdwallet-core";
import * as native from "@shapeshiftoss/hdwallet-native";
import * as bip39 from "bip39";
import * as ta from "type-assertions";
import * as uuid from "uuid";

import { ISealableVaultFactory, IVault, VaultPrepareParams } from "../types";
import { crypto, GENERATE_MNEMONIC, Revocable, setCrypto, shadowedMap } from "../util";

ta.assert<ta.Extends<typeof MockVault, ISealableVaultFactory<MockVault>>>();

type MockVaultData = {
  password: string;
  data: Array<[string, unknown]>;
  meta: Array<[string, unknown]>;
};

export class MockVault extends Revocable(Map) implements IVault, Map<string, Promise<unknown>> {
  static readonly data = new Map<string, MockVaultData>();
  static prepared = false;

  static async prepare(params?: VaultPrepareParams) {
    if (params) {
      if (this.prepared) throw new Error("can't call prepare with a parameters object after vault is already prepared");
      setCrypto(params.crypto ?? window.crypto);
    }
    this.prepared = true;
  }
  static async create(password?: string, sealed?: boolean): Promise<MockVault> {
    return await MockVault.open(undefined, password, sealed);
  }
  static async open(id?: string, password?: string, sealed?: boolean): Promise<MockVault> {
    await MockVault.prepare();
    id ??= uuid.v4({
      random: await (await crypto).getRandomValues(new Uint8Array(16)),
    });
    const out = new MockVault(id, password, sealed);
    if (id !== undefined && password !== undefined) await out.load();
    return out;
  }
  static async list() {
    return Array.from(MockVault.data.keys());
  }
  static async meta(id: string) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return MockVault.data.has(id) ? new Map(MockVault.data.get(id)!.meta) : undefined;
  }
  static async delete(id: string) {
    MockVault.data.delete(id);
  }

  readonly id: string;
  readonly meta = new Map<string, unknown>();

  _password: string | undefined = undefined;
  readonly _secrets = new Map<string, unknown>();

  protected constructor(id: string, password?: string, sealed = true) {
    super();
    this.id = id;
    this._password = password;
    if (sealed) this.seal();
  }

  async setPassword(password: string): Promise<this> {
    this._password = password;
    return this;
  }

  async load() {
    const data = MockVault.data.get(this.id);
    if (!data) throw new Error("no such vault");
    if (this._password !== data.password) throw new Error("bad password");
    this.clear();
    this._secrets.clear();
    data.data.forEach(([k, v]) => this.set(k, v));
    this.meta.clear();
    data.meta.forEach(([k, v]) => this.meta.set(k, v));
    return this;
  }

  async save() {
    if (!this._password) throw new Error("can't save without password");
    const data = {
      password: this._password,
      data: await this._unwrap().entriesAsync(),
      meta: Array.from(this.meta.entries()),
    };
    MockVault.data.set(this.id, data);
    return this;
  }

  async entriesAsync(): Promise<Array<[string, unknown]>> {
    return await Promise.all(
      Array.from(this.entries()).map(async ([k, v]: [string, Promise<unknown>]) => [k, await v] as [string, unknown])
    );
  }

  set(key: string, value: unknown | Promise<unknown>): this {
    if (!key.startsWith("#")) {
      super.set(key, Promise.resolve(value));
      return this;
    }
    if (key === "#mnemonic") {
      value = Promise.resolve(value).then(async (x) => {
        if (x !== GENERATE_MNEMONIC) return x;
        const entropy = await (await crypto).getRandomValues(Buffer.alloc(16));
        return bip39.entropyToMnemonic(entropy);
      });
    }
    this._secrets.set(key, Promise.resolve(value));
    super.set(
      key,
      (async () => {
        switch (key) {
          case "#mnemonic":
            return await native.crypto.Isolation.Engines.Default.BIP39.Mnemonic.create((await value) as string);
          default:
            return core.untouchable(key);
        }
      })()
    );
    return this;
  }

  sealed = false;
  seal() {
    this.sealed = true;
  }
  unwrap() {
    if (this.sealed) throw new Error("can't unwrap a sealed vault");
    return this._unwrap();
  }
  _unwrap() {
    return shadowedMap(
      this,
      (key: string) => {
        return key.startsWith("#") ? this._secrets.get(key) : this.get(key);
      },
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      () => {}
    );
  }
}
