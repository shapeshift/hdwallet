import {
    Keyring,
    HDWallet
  } from '@shapeshiftoss/hdwallet-core'

import { PortisTransport } from './PortisTransport'
import { Web3PortisHDWallet } from './web3Portis'

  export class Web3PortisAdapter {
    keyring: Keyring
  
    private constructor (keyring: Keyring) {
      console.log('portis adapter constructor')
      this.keyring = keyring
    }
  
    public static useKeyring (keyring: Keyring) {
      console.log('portis adapter useKeyring')
      return new Web3PortisAdapter(keyring)
    }
  
    public async initialize (portis: any): Promise<number> {
      console.log('portis adapter initialize')
      let transport = new PortisTransport(this.keyring)
      let wallet = new Web3PortisHDWallet(portis, transport)
      await wallet.initialize()
      this.keyring.add(wallet)
      return Object.keys(this.keyring.wallets).length
    }

    public async pairDevice (deviceId: string): Promise<HDWallet> {
      console.log('portis adapter pairDevices', deviceId)
      const wallet = this.keyring.get(deviceId)
      return wallet
    }
  }
