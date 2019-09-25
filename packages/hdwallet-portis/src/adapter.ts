import {
  Keyring,
  HDWallet
} from '@shapeshiftoss/hdwallet-core'

import { PortisHDWallet } from './portis'
import Portis from "@portis/web3";

type PortisWallet = any

export class PortisAdapter {
    keyring: Keyring
    portis: any
  
    private constructor (keyring: Keyring) {
      console.log('portis adapter constructor')
      this.keyring = keyring
    }
  
    public static useKeyring (keyring: Keyring) {
      console.log('portis adapter useKeyring')
      return new PortisAdapter(keyring)
    }
  
    public async initialize (): Promise<number> {
      console.log('portis adapter initialize')
      return Object.keys(this.keyring.wallets).length
    }

    public async pairDevice (args: { portis?: PortisWallet, portisAppId?: string }): Promise<HDWallet> {
      console.log('portis adapter pairDevices')
      this.portis = args.portis ? args.portis : new Portis(args.portisAppId, 'mainnet')
      let wallet = new PortisHDWallet(this.portis)
      await wallet.initialize()
      const deviceId = await wallet.getDeviceID()
      this.keyring.add(wallet, deviceId)
      return wallet
    }
  }
