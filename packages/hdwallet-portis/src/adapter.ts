import {
  Keyring,
  HDWallet,
  Events
} from '@shapeshiftoss/hdwallet-core'

import { PortisHDWallet } from './portis'
import Portis from "@portis/web3";

type PortisWallet = any

export class PortisAdapter {
  keyring: Keyring
  portis: any
  portisAppId: string
  currentDeviceId: string // wallet id to remove from the keyring when the active wallet changes

  private constructor (keyring: Keyring, args: { portis?: PortisWallet, portisAppId?: string }) {
    this.portis = args.portis
    this.portisAppId = args.portisAppId
    this.keyring = keyring
  }

  public static useKeyring (keyring: Keyring, args: { portis?: PortisWallet, portisAppId?: string }) {
    return new PortisAdapter(keyring, args)
  }

  public async initialize (): Promise<number> {
    return Object.keys(this.keyring.wallets).length
  }

  public async pairDevice (): Promise<HDWallet> {
    const wallet = this.pairPortisDevice()
    this.portis.onActiveWalletChanged( async walletAddress => {
      this.keyring.emit(["Portis", this.currentDeviceId, Events.DISCONNECT], this.currentDeviceId)
      this.keyring.remove(this.currentDeviceId)
      this.pairPortisDevice()
    })
    return wallet
  }

  private async pairPortisDevice(): Promise<HDWallet> {
    this.portis = this.portis ? this.portis : new Portis(this.portisAppId, 'mainnet')
    const wallet = new PortisHDWallet(this.portis)
    await wallet.initialize()
    const deviceId = await wallet.getDeviceID()
    this.keyring.add(wallet, deviceId)
    this.currentDeviceId = deviceId
    this.keyring.emit(["Portis", deviceId, Events.CONNECT], deviceId)
    return wallet
  }
}
