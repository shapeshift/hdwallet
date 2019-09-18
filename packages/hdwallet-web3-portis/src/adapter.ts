import {
    Keyring,
  } from '@shapeshiftoss/hdwallet-core'
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
      let wallet = new Web3PortisHDWallet()
      await wallet.initialize()
      this.keyring.add(wallet)
      return Object.keys(this.keyring.wallets).length
    }
  }
