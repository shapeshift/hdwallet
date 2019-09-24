import {
  Keyring,
  HDWallet
} from '@shapeshiftoss/hdwallet-core'

import { PortisHDWallet } from './portis'
import Portis from "@portis/web3";
import Web3 from 'web3'
import { getEthAddress } from './utils'

type PortisWallet = any

export class PortisAdapter {
    keyring: Keyring
    portis: any
  
    private constructor (keyring: Keyring, args: { portis?: PortisWallet, portisAppId?: string }) {
      console.log('portis adapter constructor')
      this.keyring = keyring
      this.portis = args.portis ? args.portis : new Portis(args.portisAppId, 'mainnet')
    }
  
    public static useKeyring (keyring: Keyring, args: {portis?: PortisWallet, portisAppId?: string} ) {
      console.log('portis adapter useKeyring')
      return new PortisAdapter(keyring, args)
    }
  
    public async initialize (): Promise<number> {
      console.log('portis adapter initialize')
      let wallet = new PortisHDWallet(this.portis)
      await wallet.initialize()
      const deviceId = await wallet.getDeviceID()
      this.keyring.add(wallet, deviceId)
      return Object.keys(this.keyring.wallets).length
    }

    public async pairDevice (): Promise<HDWallet> {
      console.log('portis adapter pairDevices')
      const web3 = new Web3(this.portis)
      const deviceId = await getEthAddress(web3)
      const wallet = this.keyring.get(deviceId)
      return wallet
    }
  }
