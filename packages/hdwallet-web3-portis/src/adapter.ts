import {
    Keyring
  } from '@shapeshiftoss/hdwallet-core'
  
  import { create as createWeb3Portis } from './web3Portis'
  
  export class Web3PortisAdapter {
    keyring: Keyring
  
    private constructor (keyring: Keyring) {
      this.keyring = keyring
    }
  
    public static useKeyring (keyring: Keyring) {
      return new Web3PortisAdapter(keyring)
    }
  
    public async initialize (web3: any): Promise<number> {
      let wallet = createWeb3Portis()
      await wallet.initialize()
      this.keyring.add(wallet)
      return Object.keys(this.keyring.wallets).length
    }
  }
