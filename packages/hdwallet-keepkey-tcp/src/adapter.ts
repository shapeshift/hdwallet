import { HDWallet, Keyring } from '@shapeshiftoss/hdwallet-core'
import { create as createKeepKey } from '@shapeshiftoss/hdwallet-keepkey'
import { TCPKeepKeyTransport } from './transport'

export class TCPKeepKeyAdapter {

  keyring: Keyring

  constructor(keyring: Keyring) {
    this.keyring = keyring
  }

  public static useKeyring(keyring: Keyring) {
    return new TCPKeepKeyAdapter(keyring)
  }

  public async initialize (hosts: Array<string>): Promise<number> {

    for (const host of hosts) {
      if (this.keyring.wallets[host]) {
        await this.keyring.get(host).transport.connect()
        await this.keyring.get(host).initialize()
      } else {
        let transport = new TCPKeepKeyTransport(host, this.keyring)

        await transport.connect()
        let wallet = createKeepKey(transport)

        await wallet.initialize()
        this.keyring.add(wallet, host)
      }
    }
    return Object.keys(this.keyring.wallets).length
  }

  public async pairDevice (host: string): Promise<HDWallet> {
    await this.initialize([host])
    return this.keyring.get(host)
  }
}
