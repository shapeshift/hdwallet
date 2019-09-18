import {
    Keyring,
    HDWallet
  } from '@shapeshiftoss/hdwallet-core'

import { PortisTransport } from './PortisTransport'
import { Web3PortisHDWallet } from './web3Portis'

  export class Web3PortisAdapter {
    keyring: Keyring
  
    private constructor (keyring: Keyring) {
      this.keyring = keyring
    }
  
    public static useKeyring (keyring: Keyring) {
      return new Web3PortisAdapter(keyring)
    }
  
    public async initialize (portis: any): Promise<number> {
      let transport = new PortisTransport(this.keyring)

      let wallet = new Web3PortisHDWallet(portis, transport)
      await wallet.initialize()
      this.keyring.add(wallet)
      return Object.keys(this.keyring.wallets).length
    }

    public async pairDevice (): Promise<HDWallet> {
      // TODO have this grab the right one based on the deviceId
      return this.keyring.get()
    }
  }
