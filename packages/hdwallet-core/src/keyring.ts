import * as eventemitter2 from "eventemitter2";

import { HDWallet } from "./wallet";

export class Keyring extends eventemitter2.EventEmitter2 {
  protected wallets: Set<HDWallet> = new Set();
  protected deviceIDs: Map<string, HDWallet> = new Map();
  protected eventListeners: WeakMap<HDWallet, eventemitter2.Listener> = new WeakMap();

  constructor() {
    super({ wildcard: true });
  }

  public async add(wallet: HDWallet, deviceID?: string): Promise<this> {
    this.wallets.add(wallet);
    const walletDeviceId = await wallet.getDeviceID()
    this.setDeviceId(wallet, walletDeviceId);
    if (deviceID && deviceID !== walletDeviceId) this.setDeviceId(wallet, deviceID);
    this.decorateEvents(wallet, deviceID ?? walletDeviceId);
    return this
  }

  public get(deviceID?: string): HDWallet | undefined {
    if (!deviceID) return [...this.wallets.values()]?.[0]
    return this.deviceIDs.get(deviceID);
  }

  public delete(deviceID: string): Promise<void>;
  public delete(wallet: HDWallet): Promise<void>;
  public async delete(deviceIDOrWallet: string | HDWallet): Promise<void> {
    if (typeof deviceIDOrWallet === "string") {
      const wallet = this.get(deviceIDOrWallet)
      if (!wallet) return;
      return await this.delete(wallet);
    }

    const wallet = deviceIDOrWallet;

    try {
      await wallet.disconnect();
    } catch (e) {
      console.error(e);
    }

    const deviceIDs = [...this.deviceIDs.entries()].filter(([k, v])=>v === wallet).map(([k, _])=>k);
    for (const deviceID of deviceIDs) {
      this.deviceIDs.delete(deviceID);
    }
    this.wallets.delete(wallet);

    this.decorateEvents(wallet);
  }
  
  // Returns all device IDs, grouped by wallet, in order of wallet insertion.
  public keys(): Iterable<string> {
    return [...this.wallets.values()].map((wallet) =>
      [...this.deviceIDs.entries()].filter(([_, v]) => v === wallet).map(([k, _]) => k)
    ).reduce((a, x) => a.concat(x), [])
  }

  // Returns all [deviceID, wallet] pairs, with dupes for wallets with multiple IDs registered.
  public entries(): Iterable<[string, HDWallet]> {
    return [...this.keys()].map(x => [x, this.deviceIDs.get(x)!])
  }

  // Returns all wallets registered in order of insertion. No dupes this time.
  public values(): Iterable<HDWallet> {
    return this.wallets.values();
  }

  public get size(): number {
    return this.wallets.size;
  }

  public async deleteAll(): Promise<void> {
    await Promise.all([...this.wallets.values()].map(x=>this.delete(x)))
  }

  public async disconnectAll(): Promise<void> {
    await Promise.all([...this.wallets.values()].map(x=>x.disconnect()))
  }

  protected setDeviceId(wallet: HDWallet, deviceID: string): void {
    if (!this.wallets.has(wallet)) return;
    const oldWallet = this.deviceIDs.get(deviceID);
    if (oldWallet === wallet) return;
    if (oldWallet) throw new Error("Keyring: wallets must have unique device IDs");
    this.deviceIDs.set(deviceID, wallet);
    this.decorateEvents(wallet, deviceID);
  }

  protected decorateEvents(wallet: HDWallet, deviceID?: string): void {
    const oldListener = this.eventListeners.get(wallet);
    if (oldListener) {
      wallet.transport?.offAny(oldListener);
      wallet.events?.offAny(oldListener);
    }

    if (!this.wallets.has(wallet)) return;

    const vendor: string = wallet.getVendor();
    const deviceIDPromise: Promise<string> = deviceID ? Promise.resolve(deviceID) : wallet.getDeviceID();
    const listener = async (e: string | string[], ...values: any[]) => {
      const deviceID = await deviceIDPromise;
      const msg = typeof e === "string" ? e : e.join(";");
      this.emit([vendor, deviceID, msg], [deviceID, ...values]);
    }
    wallet.transport?.onAny(listener);
    wallet.events?.onAny(listener);
    this.eventListeners.set(wallet, listener);
  }
}
