import Web3 from 'web3'
import {
  HDWallet,
  GetPublicKey,
  PublicKey,
  RecoverDevice,
  ResetDevice,
  Coin,
  Ping,
  Pong,
  LoadDevice,
  ETHWallet,
  ETHGetAddress,
  ETHSignTx,
  ETHGetAccountPath,
  ETHAccountPath,
  ETHSignMessage,
  ETHSignedMessage,
  ETHVerifyMessage,
  ETHSignedTx,
  DescribePath,
  PathDescription,
  addressNListToBIP32,
  Transport,
  Keyring,
  HDWalletInfo,
  ETHWalletInfo,
  BTCWallet,
  BTCGetAddress,
  BTCSignTx,
  BTCSignedTx,
  BTCSignMessage,
  BTCSignedMessage,
  BTCVerifyMessage,
  BTCInputScriptType,
  BTCGetAccountPaths,
  BTCAccountPath,
  BTCWalletInfo,
  slip44ByCoin
} from "@shapeshiftoss/hdwallet-core"
import * as eth from './ethereum'
import * as btc from './bitcoin'
import { isObject } from 'lodash';

// We might not need this. Leaving it for now to debug further
class PortisTransport extends Transport {
  public getDeviceID() {
    return 'portis:0'
  }

  public call (...args: any[]): Promise<any> {
    return Promise.resolve()
  }
}

export function isPortis(wallet: HDWallet): wallet is PortisHDWallet {
  return isObject(wallet) && (wallet as any)._isPortis
}

export class PortisHDWallet implements HDWallet, ETHWallet, BTCWallet {
  _supportsETH: boolean = true
  _supportsETHInfo: boolean = true
  _supportsBTCInfo: boolean = true
  _supportsBTC: boolean = true
  _supportsCosmosInfo: boolean = false
  _supportsCosmos: boolean = false
  _supportsBinanceInfo: boolean = false
  _supportsBinance: boolean = false
  _supportsDebugLink: boolean = false
  _isPortis: boolean = true

  transport = new PortisTransport(new Keyring())

  portis: any
  web3: any
  info: PortisHDWalletInfo & HDWalletInfo
  ethAddress: string

  // used as a mutex to ensure calls to portis.getExtendedPublicKey cannot happen before a previous call has resolved
  portisCallInProgress: Promise<any> = Promise.resolve()

  constructor(portis) {
    this.portis = portis
    this.web3 = new Web3(portis.provider)
    this.info = new PortisHDWalletInfo()
  }

  public async isLocked(): Promise<boolean> {
    return false
  }

  public getVendor(): string {
    return "Portis"
  }

  public getModel(): Promise<string> {
    return Promise.resolve('portis')
  }

  public getLabel(): Promise<string> {
    return Promise.resolve('Portis')
  }

  public initialize(): Promise<any> {
    // no means to reset the state of the Portis widget
    // while it's in the middle of execution
    return Promise.resolve()
  }

  public hasOnDevicePinEntry(): boolean {
    return this.info.hasOnDevicePinEntry()
  }

  public hasOnDevicePassphrase(): boolean {
    return this.info.hasOnDevicePassphrase()
  }

  public hasOnDeviceDisplay(): boolean {
    return this.info.hasOnDeviceDisplay()
  }

  public hasOnDeviceRecovery(): boolean {
    return this.info.hasOnDeviceRecovery()
  }

  public hasNativeShapeShift(
    srcCoin: Coin,
    dstCoin: Coin
  ): boolean {
    return this.info.hasNativeShapeShift(srcCoin, dstCoin)
  }

  public clearSession(): Promise<void> {
    return this.portis.logout()
  }

  public ping(msg: Ping): Promise<Pong> {
    // no ping function for Portis, so just returning Pong
    return Promise.resolve({ msg: msg.msg })
  }

  public sendPin(pin: string): Promise<void> {
    // no concept of pin in Portis
    return Promise.resolve()
  }

  public sendPassphrase(passphrase: string): Promise<void> {
    // cannot send passphrase to Portis. Could show the widget?
    return Promise.resolve()
  }

  public sendCharacter(charater: string): Promise<void> {
    // no concept of sendCharacter in Portis
    return Promise.resolve()
  }

  public sendWord(word: string): Promise<void> {
    // no concept of sendWord in Portis
    return Promise.resolve()
  }

  public cancel(): Promise<void> {
    // no concept of cancel in Portis
    return Promise.resolve()
  }

  public wipe(): Promise<void> {
    return Promise.resolve()
  }

  public reset(msg: ResetDevice): Promise<void> {
    return Promise.resolve()
  }

  public recover(msg: RecoverDevice): Promise<void> {
    // no concept of recover in Portis
    return Promise.resolve()
  }

  public loadDevice (msg: LoadDevice): Promise<void> {
    return this.portis.importWallet(msg.mnemonic)
  }

  public describePath (msg: DescribePath): PathDescription {
    return this.info.describePath(msg)
  }

  public async getPublicKeys(msg: Array<GetPublicKey>): Promise<Array<PublicKey | null>> {
    const publicKeys = []
    this.portisCallInProgress = new Promise( async (resolve, reject) => {
      try {
          await this.portisCallInProgress
      } catch (e) {
          console.error(e)
      }
      for (let i = 0; i < msg.length; i++) {
        const { addressNList, coin } = msg[i];
        const bitcoinSlip44 = 0x80000000 + slip44ByCoin('Bitcoin')
        // TODO we really shouldnt be every using the "bitcoin" string parameter but is here for now to make it work with their btc address on their portis wallet.
        const portisResult = await this.portis.getExtendedPublicKey(addressNListToBIP32(addressNList), addressNList[1] === bitcoinSlip44 ? 'Bitcoin' : '')
        const { result, error } = portisResult
        if(error)
          reject(error)
        publicKeys.push({ xpub: result })
      }
      resolve(publicKeys)
    })
    return this.portisCallInProgress
  }

  public async isInitialized (): Promise<boolean> {
    return true
  }

  public disconnect (): Promise<void> {
    return Promise.resolve()
  }

  public async btcGetAddress (msg: BTCGetAddress): Promise<string> {
    return btc.btcGetAddress(msg, this.portis)
  }

  public async btcSignTx (msg: BTCSignTx): Promise<BTCSignedTx> {
    return btc.btcSignTx(msg, this.portis)
  }

  public async btcSignMessage (msg: BTCSignMessage): Promise<BTCSignedMessage> {
    // portis doesnt support this for btc
    return undefined
  }

  public async btcVerifyMessage (msg: BTCVerifyMessage): Promise<boolean> {
    return btc.btcVerifyMessage(msg)
  }

  public async btcSupportsCoin (coin: Coin): Promise<boolean> {
    return this.info.btcSupportsCoin(coin)
  }

  public async btcSupportsScriptType (coin: Coin, scriptType: BTCInputScriptType): Promise<boolean> {
    return this.info.btcSupportsScriptType(coin, scriptType)
  }

  public async btcSupportsSecureTransfer (): Promise<boolean> {
    return this.info.btcSupportsSecureTransfer()
  }

  public btcSupportsNativeShapeShift (): boolean {
    return this.info.btcSupportsNativeShapeShift()
  }

  public btcGetAccountPaths (msg: BTCGetAccountPaths): Array<BTCAccountPath> {
    return this.info.btcGetAccountPaths(msg)
  }

  public btcIsSameAccount (msg: Array<BTCAccountPath>): boolean {
    return this.info.btcIsSameAccount(msg)
  }

  public btcNextAccountPath (msg: BTCAccountPath): BTCAccountPath | undefined {
    return this.info.btcNextAccountPath(msg)
  }

  public async ethSupportsNetwork (chainId: number = 1): Promise<boolean> {
    return this.info.ethSupportsNetwork(chainId)
  }

  public async ethSupportsSecureTransfer (): Promise<boolean> {
    return this.info.ethSupportsSecureTransfer()
  }

  public ethSupportsNativeShapeShift (): boolean {
    return this.info.ethSupportsNativeShapeShift()
  }

  public async ethVerifyMessage (msg: ETHVerifyMessage): Promise<boolean> {
    return eth.ethVerifyMessage(msg, this.web3)
  }

  public ethNextAccountPath (msg: ETHAccountPath): ETHAccountPath | undefined {
    // Portis only supports one account for eth
    return this.info.ethNextAccountPath(msg)
  }

  public async ethSignTx (msg: ETHSignTx): Promise<ETHSignedTx> {
    return eth.ethSignTx(msg, this.web3, await this._ethGetAddress())
  }

  public async ethSignMessage (msg: ETHSignMessage): Promise<ETHSignedMessage> {
    return eth.ethSignMessage(msg, this.web3, await this._ethGetAddress())
  }

  public ethGetAccountPaths (msg: ETHGetAccountPath): Array<ETHAccountPath> {
    return this.info.ethGetAccountPaths(msg)
  }

  public async ethGetAddress (msg: ETHGetAddress): Promise<string> {
    if(msg.showDisplay === true) {
      this.portis.showPortis()
    }
    return this._ethGetAddress()
  }

  public async getDeviceID(): Promise<string> {
    return 'portis:' + (await this._ethGetAddress())
  }

  public async getFirmwareVersion(): Promise<string> {
    return 'portis'
  }

  public async _ethGetAddress(): Promise<string> {
    if(!this.ethAddress) {
      this.ethAddress = (await this.web3.eth.getAccounts())[0]
    }
    return this.ethAddress
  }

}

export class PortisHDWalletInfo implements HDWalletInfo, ETHWalletInfo, BTCWalletInfo {
  _supportsBTCInfo: boolean = true
  _supportsETHInfo: boolean = true
  _supportsCosmosInfo: boolean = false
  _supportsBinanceInfo: boolean = false

  public getVendor (): string {
    return "Portis"
  }

  public hasOnDevicePinEntry (): boolean {
    return true
  }

  public hasOnDevicePassphrase (): boolean {
    return true
  }

  public hasOnDeviceDisplay (): boolean {
    return true
  }

  public hasOnDeviceRecovery (): boolean {
    return true
  }

  public hasNativeShapeShift (srcCoin: Coin, dstCoin: Coin): boolean {
    // It doesn't... yet?
    return false
  }

  public describePath (msg: DescribePath): PathDescription {
    switch (msg.coin) {
      case 'Ethereum':
        return eth.describeETHPath(msg.path)
      case 'Bitcoin':
        return btc.describeUTXOPath(msg.path, msg.coin, msg.scriptType)
      default:
        throw new Error("Unsupported path")
      }
  }

  public async btcSupportsCoin (coin: Coin): Promise<boolean> {
    return btc.btcSupportsCoin(coin)
  }

  public async btcSupportsScriptType (coin: Coin, scriptType: BTCInputScriptType): Promise<boolean> {
    return btc.btcSupportsScriptType(coin, scriptType)
  }

  public async btcSupportsSecureTransfer (): Promise<boolean> {
    return Promise.resolve(false)
  }

  public btcSupportsNativeShapeShift (): boolean {
    return false
  }

  public btcGetAccountPaths (msg: BTCGetAccountPaths): Array<BTCAccountPath> {
    return btc.btcGetAccountPaths(msg)
  }

  public btcIsSameAccount (msg: Array<BTCAccountPath>): boolean {
    return false
  }

  public btcNextAccountPath (msg: BTCAccountPath): BTCAccountPath | undefined {
    return btc.btcNextAccountPath(msg)
  }

  public ethNextAccountPath (msg: ETHAccountPath): ETHAccountPath | undefined {
    // Portis only supports one account for eth
    return undefined
  }

  public async ethSupportsNetwork (chainId: number = 1): Promise<boolean> {
    return chainId === 1
  }

  public async ethSupportsSecureTransfer (): Promise<boolean> {
    return false
  }

  public ethSupportsNativeShapeShift (): boolean {
    return false
  }

  public ethGetAccountPaths (msg: ETHGetAccountPath): Array<ETHAccountPath> {
    return eth.ethGetAccountPaths(msg)
  }
}

export function info () {
  return new PortisHDWalletInfo()
}

export type Portis = any

export function create (portis: Portis): PortisHDWallet {
  return new PortisHDWallet(portis)
}
