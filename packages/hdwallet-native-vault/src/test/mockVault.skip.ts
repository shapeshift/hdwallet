/* This is intended to be used to test the tests. It should not be shipped or *shudder* actually used. */
import * as core from "@shapeshiftoss/hdwallet-core";
import * as native from "@shapeshiftoss/hdwallet-native";
import * as bip39 from "bip39";
import * as ta from "type-assertions";
import * as uuid from "uuid";

import { AsyncMap, fromAsyncIterable, IAsyncMap, toAsyncIterableIterator } from "../asyncMap";
import { ISealableVaultFactory, IVault, VaultPrepareParams } from "../types"
import { GENERATE_MNEMONIC, crypto, setCrypto, shadowedAsyncMap } from "../util"

ta.assert<ta.Extends<typeof MockVault, ISealableVaultFactory<MockVault>>>();

type MockVaultData = {
  password: string,
  data: Array<[string, unknown]>,
  meta: Array<[string, unknown]>
}

export class MockVault
  extends core.Revocable(AsyncMap as core.Constructor<AsyncMap>)
  implements IVault, IAsyncMap<string, unknown>
{
  static readonly data = new Map<string, MockVaultData>()
  static prepared = false;

  static async prepare(params?: VaultPrepareParams) {
    if (params) {
      if (this.prepared) throw new Error("can't call prepare with a parameters object after vault is already prepared")
      setCrypto(params.crypto ?? window.crypto)
    }
    this.prepared = true
  }
  static async create(password?: string, sealed?: boolean): Promise<MockVault> {
    return await MockVault.open(undefined, password, sealed);
  }
  static async open(id?: string, password?: string, sealed?: boolean): Promise<MockVault> {
    await MockVault.prepare()
    id ??= uuid.v4({
      random: await (await crypto).getRandomValues(new Uint8Array(16)),
    })
    const out = new MockVault(id, password, sealed)
    if (id !== undefined && password !== undefined) await out.load();
    return out
  }
  static async list() { return toAsyncIterableIterator(MockVault.data.keys()) }
  static async meta(id: string) { return MockVault.data.has(id) ? await AsyncMap.create(MockVault.data.get(id)!.meta) : undefined; }
  static async delete(id: string) { MockVault.data.delete(id); }

  readonly id: Promise<string>
  readonly meta = AsyncMap.create<string, unknown>()

  _password: string | undefined = undefined
  readonly _secrets = new Map<string, unknown>()

  protected constructor(id: string, password?: string, sealed: boolean = true) {
    super()
    this.id = Promise.resolve(id)
    this._password = password
    if (sealed) this.seal()
  }

  async setPassword(password: string): Promise<void> {
    this._password = password
  }

  async load() {
    const data = MockVault.data.get(await this.id)
    if (!data) throw new Error('no such vault')
    if (this._password !== data.password) throw new Error('bad password')
    await this.clear()
    this._secrets.clear()
    await Promise.all(data.data.map(async ([k, v]) => await this.set(k, v)))
    await (await this.meta).clear()
    await Promise.all(data.meta.map(async ([k, v]) => await (await this.meta).set(k, v)))
  }

  async save() {
    if (!this._password) throw new Error("can't save without password")
    const data = {
      password: this._password,
      data: await fromAsyncIterable(await (await this._unwrap()).entries()),
      meta: await fromAsyncIterable(await (await this.meta).entries())
    }
    MockVault.data.set(await this.id, data)
  }

  async set(key: string, value: unknown): Promise<this> {
    if (!key.startsWith('#')) {
      await super.set(key, value)
      return this
    }
    if (key === '#mnemonic' && value === GENERATE_MNEMONIC) {
      const entropy = await (await crypto).getRandomValues(Buffer.alloc(16))
      value = bip39.entropyToMnemonic(entropy)
    }
    this._secrets.set(key, value)
    super.set(key, await (async () => {
      switch (key) {
        case '#mnemonic':
          return await native.crypto.Isolation.Engines.Default.BIP39.Mnemonic.create(await value as string)
        default: return core.untouchable(key)
      }
    })())
    return this
  }

  _sealed = false
  get sealed() { return Promise.resolve(this._sealed) }
  async seal() { this._sealed = true }
  async unwrap() {
    if (this._sealed) throw new Error("can't unwrap a sealed vault")
    return this._unwrap()
  }
  _unwrap() {
    return shadowedAsyncMap(this, async (key: string) => {
      return key.startsWith('#') ? this._secrets.get(key) : this.get(key)
    }, () => {})
  }
}
