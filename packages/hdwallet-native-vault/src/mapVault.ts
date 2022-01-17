import * as core from "@shapeshiftoss/hdwallet-core"
import * as ta from "type-assertions";

import { AsyncMap, fromAsyncIterable, IAsyncMap, toAsyncIterableIterator } from "./asyncMap"
import { RawVault } from "./rawVault"
import { IVaultBackedBy, IVaultFactory, VaultPrepareParams } from "./types"
import { encoder, decoder } from "./util"

ta.assert<ta.Extends<typeof MapVault, IVaultFactory<MapVault>>>();

export class MapVault
  extends core.Revocable(AsyncMap as core.Constructor<AsyncMap>)
  implements IAsyncMap<string, unknown>, IVaultBackedBy<AsyncIterable<[string, unknown]>>
{
  static async prepare(params?: VaultPrepareParams) { return RawVault.prepare(params); }
  static async create(password?: string) {
    return await MapVault.open(undefined, password);
  }
  static async open(id?: string, password?: string) {
    await MapVault.prepare();
    return new MapVault(await RawVault.open(id, password));
  }
  static async list() { return await RawVault.list(); }
  static async meta(id: string) { return await RawVault.meta(id); }
  static async delete(id: string) { await RawVault.delete(id); }

  readonly #rawVault: RawVault;

  protected constructor(rawVault: RawVault) {
    super();
    this.addRevoker(() => this.clear());
    this.addRevoker(() => this.#rawVault.revoke());
    this.#rawVault = rawVault;
  }

  get id() {
    return (async () => {
      return this.#rawVault.id;
    })()
  }
  get meta() {
    return (async () => {
      return this.#rawVault.meta;
    })()
  }

  async setPassword(password: string): Promise<void> {
    await this.#rawVault.setPassword(password);
  }

  async load(deserializer: (_: AsyncIterable<[string, unknown]>) => Promise<void>) {
    await this.#rawVault.load(async (x: Uint8Array): Promise<void> => {
      const obj = JSON.parse(decoder.decode(x));
      await deserializer(toAsyncIterableIterator(Object.entries(obj)));
    });
  }

  async save(serializer: () => Promise<AsyncIterable<[string, unknown]>>) {
    await this.#rawVault.save(async (): Promise<Uint8Array> => {
      const payloadObj = (await fromAsyncIterable(await serializer()))
        .sort((a, b) => {
          if (a[0] < b[0]) return -1;
          if (a[0] > b[0]) return 1;
          return 0;
        })
        .reduce((a, [k, v]) => ((a[k] = v), a), {} as Record<string, unknown>);
      return encoder.encode(JSON.stringify(payloadObj));
    });
  }
}

Object.freeze(MapVault);
Object.freeze(MapVault.prototype);
Object.freeze(Object.getPrototypeOf(MapVault));
