import {
  Keyring,
  HDWallet
} from '@shapeshiftoss/hdwallet-core'

import { PortisTransport } from './PortisTransport'
import { Web3PortisHDWallet } from './web3Portis'
import Portis from "@portis/web3";
import { getPortisEthAddress } from './utils'

type PortisWallet = any

export class Web3PortisAdapter {
    keyring: Keyring
    portis: any
  
    private constructor (keyring: Keyring, args: { portis?: PortisWallet, portisAppId?: string }) {
      console.log('portis adapter constructor')
      this.keyring = keyring
      this.portis = args.portis ? args.portis : new Portis(args.portisAppId, 'mainnet')
    }
  
    public static useKeyring (keyring: Keyring, args: {portis?: PortisWallet, portisAppId?: string} ) {
      console.log('portis adapter useKeyring')
      return new Web3PortisAdapter(keyring, args)
    }
  
    public async initialize (): Promise<number> {
      console.log('portis adapter initialize')
      let transport = new PortisTransport(this.keyring)
      let wallet = new Web3PortisHDWallet(this.portis, transport)
      await wallet.initialize()
      const deviceId = await getPortisEthAddress(this.portis)
      this.keyring.add(wallet, deviceId)
      return Object.keys(this.keyring.wallets).length
    }

    public async pairDevice (): Promise<HDWallet> {
      console.log('portis adapter pairDevices')
      const deviceId = await getPortisEthAddress(this.portis)
      const wallet = this.keyring.get(deviceId)
      return wallet
    }
  }
