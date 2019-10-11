import { HDWallet } from './wallet'
import * as eventemitter2 from 'eventemitter2'

export class Keyring extends eventemitter2.EventEmitter2 {

  public wallets: { [deviceID: string]: HDWallet } = {}
  public aliases: { [deviceID: string]: string } = {}

  constructor() {
    super(({ wildcard: true }))
  }

  public add (wallet: HDWallet, deviceID?: string): boolean {
    const id = deviceID || new Date().toString()
    if (!(this.wallets[id])) {
      this.wallets[id] = wallet
      this.decorateEvents(deviceID, wallet.transport)
      return true
    }
    return false
  }

  public addAlias (aliasee: string, alias: string): void {
    this.aliases[alias] = aliasee
  }

  public getAlias (aliasee: string): string {
    const keys =  Object.keys(this.aliases)
    const values =  Object.values(this.aliases)
    const index = values.indexOf(aliasee)
    if(index !== -1) return keys[index]
    return aliasee
  }

  public async exec (method: string, ...args: any[]): Promise<{ [deviceID: string]: any }> {
    return Promise.all(
      Object.values(this.wallets)
        .map(w => w[method](...args))
    ).then(values => values.reduce((final, response, i) => {
      final[Object.keys(this.wallets)[i]] = response
      return final
    }, {}))
  }

  public get (deviceID?: string): HDWallet {
    if (this.aliases[deviceID] && this.wallets[this.aliases[deviceID]])
      return this.wallets[this.aliases[deviceID]]
    if (this.wallets[deviceID]) return this.wallets[deviceID]
    if (!!this.get() && !deviceID) return Object.values(this.wallets)[0]
    return null
  }

  public async remove (deviceID: string): Promise<void> {
    if (!this.get(deviceID)) return

    try {
      const keepkey = this.get(deviceID)
      await keepkey.disconnect()
    } catch (e) {
      console.error(e)
    } finally {
      let aliasee = this.aliases[deviceID]
      if (aliasee) {
        delete this.aliases[deviceID]
        delete this.wallets[aliasee]
      } else {
        delete this.wallets[deviceID]
      }
    }
  }

  public async removeAll (): Promise<void> {
    await Promise.all(Object.keys(this.wallets).map(this.remove.bind(this)))
    this.aliases = {}
  }

  public async disconnectAll (): Promise<void> {
    const wallets = Object.values(this.wallets)
    for(let i = 0; i < wallets.length; i++) {
      await wallets[i].disconnect()
    }
  }

  public async decorateEvents (deviceID: string, events: eventemitter2.EventEmitter2): Promise<void> {
    const wallet: HDWallet = this.get(deviceID)
    const vendor: string = wallet.getVendor()
    events.onAny((e: string, ...values: any[]) => this.emit([vendor, deviceID, e], [deviceID, ...values]))
  }
}
