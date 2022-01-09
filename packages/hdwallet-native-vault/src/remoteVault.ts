import * as core from "@shapeshiftoss/hdwallet-core"

import { ISealableVaultFactory, IVault } from "./types";
import { shadowedMap } from "./util";

export class RemoteVaultFactoryServer extends core.RemoteServer {
  readonly factory: ISealableVaultFactory<IVault>

  constructor(factory: ISealableVaultFactory<IVault>) {
    super()
    this.factory = factory
  }

  protected async handleCall(method: string, ...args: unknown[]): Promise<unknown> {
    switch (method) {
      case "prepare":
        if (args.length > 0) throw new Error("can't prepare remote vault with specific params")
        await this.factory.prepare();
        return;
      case "open": {
        const vault = await this.factory.open(...(args as Parameters<ISealableVaultFactory<IVault>["open"]>));
        const server = await RemoteVaultServer.create(vault);
        const out: RemoteVaultParams = {
          id: vault.id,
          meta: Array.from(vault.meta.entries()),
          sealed: vault.sealed,
          keys: Array.from(vault.keys()),
          port: server.messagePort
        }
        return out
      }
      case "list":
        return await this.factory.list(...(args as Parameters<ISealableVaultFactory<IVault>["list"]>));
      case "meta":
        return Array.from((await this.factory.meta(...(args as Parameters<ISealableVaultFactory<IVault>["meta"]>)))?.entries() ?? []);
      case "delete":
        await this.factory.delete(...(args as Parameters<ISealableVaultFactory<IVault>["delete"]>));
        return;
      default:
        throw new Error('no such method');
    }
  }
}

type RemoteVaultParams = {
  id: string,
  meta: [string, unknown][],
  sealed: boolean,
  keys: string[],
  port: MessagePort
}

export class RemoteVaultFactory extends core.RemoteClient implements ISealableVaultFactory<any> {
  get name() {
    return this.constructor.name
  }

  constructor(messagePort: MessagePort | Promise<MessagePort>) {
    super(messagePort)
  }

  async prepare(): Promise<void> {
    return await this.call("prepare")
  }

  async create(password?: string, sealed?: boolean): Promise<RemoteVault> {
    return await this.open(undefined, password, sealed);
  }

  async open(id?: string, password?: string, sealed?: boolean): Promise<RemoteVault> {
    const params: RemoteVaultParams = await this.call("open", id, password, sealed)
    return await RemoteVault.create(params)
  }

  async list(): Promise<string[]> {
    return await this.call("list")
  }

  async meta(id: string): Promise<Map<string, unknown> | undefined> {
    return new Map(await this.call("meta", id))
  }

  async delete(id: string): Promise<void> {
    return await this.call("delete", id)
  }
}

export class RemoteVaultServer extends core.RemoteServer {
  readonly #vault: IVault

  protected constructor(vault: IVault) {
    super()
    this.#vault = vault
  }

  static async create(vault: IVault) {
    return new RemoteVaultServer(vault)
  }

  protected async handleCall(method: string, ...args: unknown[]): Promise<unknown> {
    switch (method) {
      case "id": {
        return this.#vault.id;
      }
      case "meta": {
        return Array.from(this.#vault.meta.entries());
      }
      case "sealed": {
        return this.#vault.sealed;
      }
      case "keys": {
        return Array.from(this.#vault.keys())
      }
      case "clear": {
        this.#vault.clear()
        return
      }
      case "delete": {
        const [ key ] = args as [string]
        return this.#vault.delete(key)
      }
      case "get": {
        const [ key ] = args as [string]
        return await this.#vault.get(key)
      }
      case "set": {
        const [ key, value ] = args as [string, unknown]
        await this.#vault.set(key, value)
        return
      }
      case "entriesAsync": {
        return await this.#vault.entriesAsync()
      }
      case "seal": {
        this.#vault.seal()
        return
      }
      case "getUnwrapped": {
        const [ key ] = args as [string]
        return await this.#vault.unwrap().get(key)
      }
      case "setPassword": {
        const [ password ] = args as [string]
        await this.#vault.setPassword(password)
        return
      }
      case "load": {
        await this.#vault.load()
        return {
          keys: Array.from(this.#vault.keys()),
          metaEntries: this.#vault.meta.entries()
        }
      }
      case "save": {
        const [ metaEntries ] = args as [[string, unknown][]]
        const meta = this.#vault.meta
        meta.clear()
        metaEntries.forEach(([k, v]) => meta.set(k, v))
        await this.#vault.save()
        return
      }
      default: {
        throw new Error('no such method');
      }
    }
  }
}

export class RemoteVault extends core.RemoteClient implements IVault {
  readonly [Symbol.toStringTag] = RemoteVault.name

  readonly id: string
  readonly meta: Map<string, unknown>

  #sealed: boolean;
  get sealed() {
    if (this.#sealed === undefined) throw new Error('sealed not set')
    return this.#sealed
  }

  readonly #keys: Set<string>
  get size() {
    return this.#keys.size
  }

  protected constructor(params: RemoteVaultParams) {
    super(params.port)
    this.id = params.id
    this.meta = new Map(params.meta)
    this.#sealed = params.sealed
    this.#keys = new Set(params.keys)
  }

  static async create(params: RemoteVaultParams): Promise<RemoteVault> {
    const out = new RemoteVault(params)
    return out
  }

  clear() {
    this.#keys.clear()
    this.call("clear").catch(e => console.error(e))
  }

  delete(key: string): boolean {
    const out = this.#keys.delete(key)
    this.call("delete", key).catch(e => console.error(e))
    return out
  }

  get(key: string): Promise<unknown> | undefined {
    if (!this.#keys.has(key)) return undefined
    return this.call("get", key).catch(e => console.error(e))
  }

  has(key: string): boolean {
    return this.#keys.has(key)
  }

  forEach(callbackfn: (value: Promise<unknown>, key: string, map: Map<string, Promise<unknown>>) => void, thisArg?: any): void {
    for (const key of this.#keys) {
      callbackfn.call(thisArg, this.get(key)!, key, this)
    }
  }

  set(key: string, value: unknown | Promise<unknown>): this {
    this.#keys.add(key);
    this.call("set", async () => {
      return [key, await value]
    }).catch(e => console.error(e))
    return this
  }

  keys(): IterableIterator<string> {
    return Array.from(this.#keys.keys()) as any
  }

  values(): IterableIterator<Promise<unknown>> {
    return Array.from(this.entries()).map(([, v]) => v) as any
  }

  entries(): IterableIterator<[string, Promise<unknown>]> {
    const keys = Array.from(this.#keys.keys())
    const entries = keys.map(k => [k, this.call("get", k)] as [string, Promise<unknown>])
    return entries as any
  }

  async entriesAsync(): Promise<Array<[string, unknown]>> {
    return await this.call("entriesAsync")
  }

  seal() {
    this.#sealed = true
    this.call("seal").catch(e => console.error(e))
  }

  unwrap(addRevoker?: (revoke: () => void) => void) {
    if (this.#sealed) throw new Error("can't unwrap a sealed vault");
    return shadowedMap(this, (x: string) => {
      if (!this.#keys.has(x)) return undefined;
      return this.call("getUnwrapped", x);
    }, (x) => {
      this.addRevoker(x);
      addRevoker?.(x);
    });
  }

  [Symbol.iterator]() {
    return this.entries()
  }

  async setPassword(password: string): Promise<this> {
    await this.call("setPassword", password)
    return this
  }

  async load(): Promise<this> {
    const { keys, metaEntries }: {
      keys: string[]
      metaEntries: [string, unknown][]
    } = await this.call("load")
    this.#keys.clear()
    keys.forEach(x => this.#keys.add(x))
    this.meta.clear()
    metaEntries.forEach(([k, v]) => this.meta.set(k, v))
    return this
  }

  async save(): Promise<this> {
    await this.call("save", Array.from(this.meta.entries()))
    return this
  }
}
