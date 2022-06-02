import * as eventemitter2 from "eventemitter2";

import { HDWallet } from "./wallet";

export class Keyring extends eventemitter2.EventEmitter2 {
  public wallets: { [deviceID: string]: HDWallet } = {};
  public aliases: { [deviceID: string]: string } = {};

  constructor() {
    super({ wildcard: true });
  }

  public add(wallet: HDWallet, deviceID?: string): boolean {
    const id = deviceID || new Date().toString();
    if (!this.wallets[id]) {
      this.wallets[id] = wallet;
      wallet.transport && this.decorateEvents(id, wallet.transport);
      return true;
    }
    return false;
  }

  public addAlias(aliasee: string, alias: string): void {
    this.aliases[alias] = aliasee;
  }

  public getAlias(aliasee: string): string {
    const keys = Object.keys(this.aliases);
    const values = Object.values(this.aliases);
    const index = values.indexOf(aliasee);
    if (index !== -1) return keys[index];
    return aliasee;
  }

  public async exec(method: string, ...args: any[]): Promise<{ [deviceID: string]: any }> {
    return Promise.all(
      Object.values(this.wallets).map((w) => {
        const fn: unknown = (w as any)[method];
        if (typeof fn !== "function") throw new Error(`can't exec non-existent method ${method}`);
        return fn.call(w, ...args);
      })
    ).then((values) =>
      values.reduce((final, response, i) => {
        final[Object.keys(this.wallets)[i]] = response;
        return final;
      }, {})
    );
  }

  public get<T extends HDWallet>(deviceID?: string): T | null {
    if (deviceID && this.aliases[deviceID] && this.wallets[this.aliases[deviceID]])
      return this.wallets[this.aliases[deviceID]] as T;
    if (deviceID && this.wallets[deviceID]) return this.wallets[deviceID] as T;
    if (!!Object.keys(this.wallets).length && !deviceID) return Object.values(this.wallets)[0] as T;
    return null;
  }

  public async remove(deviceID: string): Promise<void> {
    const wallet = this.get(deviceID);
    if (!wallet) return;

    try {
      await wallet.disconnect();
    } catch (e) {
      console.error(e);
    } finally {
      const aliasee = this.aliases[deviceID];
      if (aliasee) {
        delete this.aliases[deviceID];
        delete this.wallets[aliasee];
      } else {
        delete this.wallets[deviceID];
      }
    }
  }

  public async removeAll(): Promise<void> {
    await Promise.all(Object.keys(this.wallets).map(this.remove.bind(this)));
    this.aliases = {};
  }

  public async disconnectAll(): Promise<void> {
    const wallets = Object.values(this.wallets);
    for (let i = 0; i < wallets.length; i++) {
      await wallets[i].disconnect();
    }
  }

  public decorateEvents(deviceID: string, events: eventemitter2.EventEmitter2): void {
    const wallet: HDWallet | null = this.get(deviceID);
    if (!wallet) return;
    const vendor: string = wallet.getVendor();
    events.onAny((e: string | string[], ...values: any[]) =>
      this.emit([vendor, deviceID, typeof e === "string" ? e : e.join(";")], [deviceID, ...values])
    );
  }
}
