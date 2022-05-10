import * as ta from "type-assertions";

import { RawVault } from "./rawVault";
import { IVaultBackedBy, IVaultFactory, VaultPrepareParams } from "./types";
import { decoder, encoder, Revocable } from "./util";

ta.assert<ta.Extends<typeof MapVault, IVaultFactory<MapVault>>>();

export class MapVault
  extends Revocable(Map)
  implements Map<string, unknown | Promise<unknown>>, IVaultBackedBy<Array<[string, unknown | Promise<unknown>]>>
{
  static async prepare(params?: VaultPrepareParams) {
    return RawVault.prepare(params);
  }
  static async create(password?: string) {
    return await MapVault.open(undefined, password);
  }
  static async open(id?: string, password?: string) {
    await MapVault.prepare();
    return new MapVault(await RawVault.open(id, password));
  }
  static list() {
    return RawVault.list();
  }
  static meta(id: string) {
    return RawVault.meta(id);
  }
  static delete(id: string) {
    return RawVault.delete(id);
  }

  readonly #rawVault: RawVault;

  protected constructor(rawVault: RawVault) {
    super();
    this.addRevoker(() => this.clear());
    this.addRevoker(() => this.#rawVault.revoke());
    this.#rawVault = rawVault;
  }

  get id() {
    return this.#rawVault.id;
  }
  get meta() {
    return this.#rawVault.meta;
  }

  async setPassword(password: string): Promise<this> {
    await this.#rawVault.setPassword(password);
    return this;
  }

  async load(deserializer: (_: Array<[string, unknown | Promise<unknown>]>) => Promise<void>) {
    await this.#rawVault.load(async (x: Uint8Array): Promise<void> => {
      const obj = JSON.parse(decoder.decode(x));
      await deserializer(Object.entries(obj).map(([k, v]) => [k, Promise.resolve(v)]));
    });
    return this;
  }

  async save(serializer: () => Promise<Array<[string, unknown | Promise<unknown>]>>) {
    await this.#rawVault.save(async (): Promise<Uint8Array> => {
      const payloadObj = (
        await Promise.all((await serializer()).map(async ([k, v]): Promise<[typeof k, unknown]> => [k, await v]))
      )
        .sort((a, b) => {
          if (a[0] < b[0]) return -1;
          if (a[0] > b[0]) return 1;
          return 0;
        })
        .reduce((a, [k, v]) => ((a[k] = v), a), {} as Record<string, unknown>);
      return encoder.encode(JSON.stringify(payloadObj));
    });
    return this;
  }

  async entriesAsync(): Promise<Array<[string, unknown]>> {
    return await Promise.all(
      Array.from(this.entries()).map(async ([k, v]): Promise<[typeof k, unknown]> => [k, await v])
    );
  }
}

Object.freeze(MapVault);
Object.freeze(MapVault.prototype);
Object.freeze(Object.getPrototypeOf(MapVault));
