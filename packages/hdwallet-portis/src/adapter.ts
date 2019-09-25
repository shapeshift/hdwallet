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
    portisAppId: string
  
    private constructor (keyring: Keyring, args: { portis?: PortisWallet, portisAppId?: string }) {
      console.log('portis adapter constructor')
      this.portis = args.portis
      this.portisAppId = args.portisAppId
      this.keyring = keyring
    }
  
    public static useKeyring (keyring: Keyring, args: { portis?: PortisWallet, portisAppId?: string }) {
      console.log('portis adapter useKeyring')
      return new PortisAdapter(keyring, args)
    }
  
    public async initialize (): Promise<number> {
      console.log('portis adapter initialize')
      return Object.keys(this.keyring.wallets).length
    }

    public async pairDevice (): Promise<HDWallet> {
      console.log('portis adapter pairDevices')
      this.portis = this.portis ? this.portis : new Portis(this.portisAppId, 'mainnet')
      let wallet = new PortisHDWallet(this.portis)
      await wallet.initialize()
      const deviceId = await wallet.getDeviceID()
      this.keyring.add(wallet, deviceId)
      return wallet
    }
  }
