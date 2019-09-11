import {
  HDWallet,
  GetPublicKey,
  PublicKey,
  RecoverDevice,
  ResetDevice,
  LoadDevice,
  Coin,
  Ping,
  Pong,
  BTCWallet,
  ETHWallet,
  Constructor,
  ActionCancelled,
  DeviceDisconnected,
  PopupClosedError,
  BTCInputScriptType,
  BTCGetAddress,
  BTCSignTx,
  BTCSignedTx,
  BTCSignMessage,
  BTCVerifyMessage,
  BTCAccountPath,
  BTCSignedMessage,
  BTCGetAccountPaths,
  ETHSignTx,
  ETHSignedTx,
  ETHGetAddress,
  ETHSignMessage,
  ETHSignedMessage,
  ETHVerifyMessage,
  ETHGetAccountPath,
  ETHAccountPath,
  HDWalletInfo,
  BTCWalletInfo,
  ETHWalletInfo,
} from '@shapeshiftoss/hdwallet-core'
import { handleError } from './utils'
import * as Btc from './bitcoin'
import * as Eth from './ethereum'
import { TrezorTransport } from './transport'

export function isTrezor(wallet: HDWallet): wallet is TrezorHDWallet {
  return typeof wallet === 'object' && wallet._isTrezor === true
}

export class TrezorHDWalletInfo implements HDWalletInfo, BTCWalletInfo, ETHWalletInfo {
  _supportsBTCInfo: boolean = true
  _supportsETHInfo: boolean = true

  public getVendor (): string {
    return "Trezor"
  }

  public async btcSupportsCoin (coin: Coin): Promise<boolean> {
    return Btc.btcSupportsCoin(coin)
  }

  public async btcSupportsScriptType (coin: Coin, scriptType: BTCInputScriptType): Promise<boolean> { 
    return Btc.btcSupportsScriptType(coin, scriptType)
  }

  public async btcSupportsSecureTransfer (): Promise<boolean> {
    return Btc.btcSupportsSecureTransfer()
  }

  public async btcSupportsNativeShapeShift (): Promise<boolean> {
    return Btc.btcSupportsNativeShapeShift()
  }

  public btcGetAccountPaths (msg: BTCGetAccountPaths): Array<BTCAccountPath> {
    return Btc.btcGetAccountPaths(msg)
  }

  public btcIsSameAccount (msg: Array<BTCAccountPath>): boolean {
    return Btc.btcIsSameAccount(msg)
  }

  public async ethSupportsNetwork (chain_id: number): Promise<boolean> {
    return Eth.ethSupportsNetwork(chain_id)
  }

  public async ethSupportsSecureTransfer (): Promise<boolean> {
    return Eth.ethSupportsSecureTransfer()
  }

  public async ethSupportsNativeShapeShift (): Promise<boolean> {
    return Eth.ethSupportsNativeShapeShift()
  }

  public ethGetAccountPaths (msg: ETHGetAccountPath): Array<ETHAccountPath> {
    return Eth.ethGetAccountPaths(msg)
  }

  public async hasOnDevicePinEntry (): Promise<boolean> {
    return true
  }

  public async hasOnDevicePassphrase (): Promise<boolean> {
    return true
  }

  public async hasOnDeviceDisplay (): Promise<boolean> {
    return true
  }

  public async hasOnDeviceRecovery (): Promise<boolean> {
    // Not really meaningful since TrezorConnect doesn't expose recovery yet
    return true
  }

  public async hasNativeShapeShift (srcCoin: Coin, dstCoin: Coin): Promise<boolean> {
    // It doesn't... yet?
    return false
  }
}

export class TrezorHDWallet implements HDWallet, BTCWallet, ETHWallet {
  _supportsETHInfo: boolean = true
  _supportsBTCInfo: boolean = true
  _supportsDebugLink: boolean = false
  _supportsBTC: boolean = true
  _supportsETH: boolean = true
  _isTrezor: boolean = true
  _isKeepKey: boolean = false
  _isLedger: boolean = false

  transport: TrezorTransport
  featuresCache: any
  info: TrezorHDWalletInfo & HDWalletInfo

  constructor(transport: TrezorTransport) {
    this.transport = transport
    this.info = new TrezorHDWalletInfo()
  }

  public async initialize (): Promise<any> {
    return
  }

  public async getDeviceID (): Promise<string> {
    const { device: { deviceID: transportId }} = this.transport as any
    if (transportId)
      return transportId

    let features = await this.getFeatures(/*cached*/true)
    return features.device_id
  }

  public getVendor (): string {
    return "Trezor"
  }

  public async getModel (): Promise<string> {
    let features = await this.getFeatures(/*cached*/true)
    return "Trezor " + features.model
  }

  public async getLabel (): Promise<string> {
    let features = await this.getFeatures(/*cached*/true)
    return features.label
  }

  public async getFeatures (cached: boolean = false): Promise<any> {
    if (cached && this.featuresCache)
      return this.featuresCache
    let res = await this.transport.call('getFeatures', {})
    handleError(this.transport, res, "Could not get Trezor features")
    this.cacheFeatures(res.payload)
    return res.payload
  }

  public cacheFeatures (features: any): void {
    this.featuresCache = features
  }

  public async getPublicKeys (msg: Array<GetPublicKey>): Promise<Array<PublicKey>> {
    let res = await this.transport.call('getPublicKey', {
      bundle: msg.map(request => {
        return {
          path: request.addressNList,
          coin: 'Bitcoin',
          crossChain: true
        }
      })
    })
    handleError(this.transport, res, "Could not load xpubs from Trezor")
    return res.payload.map(result => { return {
      xpub: result.xpub
    }})
  }

  public async isLocked (): Promise<boolean> {
    const features = await this.getFeatures(false)
    if (features.pin_protection && !features.pin_cached)
      return true;
    if (features.passphrase_protection && !features.passphrase_cached)
      return true;
    return false;
  }

  public async clearSession (): Promise<void> {
    // TrezorConnect doesn't expose session management, so this is a no-op.
  }

  public async sendPin (pin: string): Promise<void> {
    await this.transport.call('uiResponse', {
      type: 'ui-receive_pin',
      payload: pin
    })
  }

  public async sendPassphrase (passphrase: string): Promise<void> {
    await this.transport.call('uiResponse', {
      type: 'ui-receive_passphrase',
      payload: {
        value: passphrase,
        save: true
      }
    })
  }

  public async sendCharacter (charater: string): Promise<void> {
    throw new Error("Trezor does not suport chiphered recovery")
  }

  public async sendWord (word: string): Promise<void> {
    throw new Error("Trezor does not yet support recoverDevice")
  }

  public async ping (msg: Ping): Promise<Pong> {
    // TrezorConnect doesn't expose the device's normal 'Ping' message, so we
    // have to fake it here:
    return { msg: msg.msg }
  }

  public async wipe (): Promise<void> {
    let res = await this.transport.call('wipeDevice', {})
    handleError(this.transport, res, "Could not wipe Trezor")
  }

  public async reset (msg: ResetDevice): Promise<void> {
    let res = await this.transport.call('resetDevice', {
      strength: msg.entropy,
      label: msg.label,
      pinProtection: msg.pin,
      passphraseProtection: msg.passphrase
    })
    handleError(this.transport, res, "Could not reset Trezor")
  }

  public async cancel (): Promise<void> {
    await this.transport.cancel()
  }

  public async recover (msg: RecoverDevice): Promise<void> {
    // https://github.com/trezor/connect/pull/320
    throw new Error("TrezorConnect does not expose RecoverDevice... yet?")
  }

  public async loadDevice (msg: LoadDevice): Promise<void> {
    // https://github.com/trezor/connect/issues/363
    let res = await this.transport.call('loadDevice', {
      mnemonic: msg.mnemonic,
      pin: msg.pin,
      passphraseProtection: msg.passphrase,
      label: msg.label
    })
    handleError(this.transport, res, "Could not load seed into Trezor")
  }

  public async hasOnDevicePinEntry (): Promise<boolean> {
    return this.transport.hasPopup
  }

  public async hasOnDevicePassphrase (): Promise<boolean> {
    return this.transport.hasPopup
  }

  public async hasOnDeviceDisplay (): Promise<boolean> {
    return true
  }

  public async hasOnDeviceRecovery (): Promise<boolean> {
    // Not really meaningful since TrezorConnect doesn't expose recovery yet
    return this.transport.hasPopup
  }

  public async hasNativeShapeShift (srcCoin: Coin, dstCoin: Coin): Promise<boolean> {
    // It doesn't... yet?
    return false
  }

  public async btcSupportsCoin (coin: Coin): Promise<boolean> {
    return this.info.btcSupportsCoin(coin)
  }

  public async btcSupportsScriptType (coin: Coin, scriptType: BTCInputScriptType): Promise<boolean> { 
    return this.info.btcSupportsScriptType(coin, scriptType)
  }

  public async btcGetAddress (msg: BTCGetAddress): Promise<string> {
    return Btc.btcGetAddress(this.transport, msg)
  }

  public async btcSignTx (msg: BTCSignTx): Promise<BTCSignedTx> {
    return Btc.btcSignTx(this, this.transport, msg)
  }

  public async btcSupportsSecureTransfer (): Promise<boolean> {
    return this.info.btcSupportsSecureTransfer()
  }

  public async btcSupportsNativeShapeShift (): Promise<boolean> {
    return this.info.btcSupportsNativeShapeShift()
  }

  public async btcSignMessage (msg: BTCSignMessage): Promise<BTCSignedMessage> {
    return Btc.btcSignMessage(this.transport, msg)
  }

  public async btcVerifyMessage (msg: BTCVerifyMessage): Promise<boolean> {
    return Btc.btcVerifyMessage(this.transport, msg)
  }

  public btcGetAccountPaths (msg: BTCGetAccountPaths): Array<BTCAccountPath> {
    return Btc.btcGetAccountPaths(msg)
  }

  public btcIsSameAccount (msg: Array<BTCAccountPath>): boolean {
    return this.info.btcIsSameAccount(msg)
  }


  public async ethSignTx (msg: ETHSignTx): Promise<ETHSignedTx> {
    return Eth.ethSignTx(this, this.transport, msg)
  }

  public async ethGetAddress (msg: ETHGetAddress): Promise<string> {
    return Eth.ethGetAddress(this.transport, msg)
  }

  public async ethSignMessage (msg: ETHSignMessage): Promise<ETHSignedMessage> {
    return Eth.ethSignMessage(this.transport, msg)
  }

  public async ethVerifyMessage (msg: ETHVerifyMessage): Promise<boolean> {
    return Eth.ethVerifyMessage(this.transport, msg)
  }

  public async ethSupportsNetwork (chain_id: number): Promise<boolean> {
    return this.info.ethSupportsNetwork(chain_id)
  }

  public async ethSupportsSecureTransfer (): Promise<boolean> {
    return this.info.ethSupportsSecureTransfer()
  }

  public async ethSupportsNativeShapeShift (): Promise<boolean> {
    return this.info.ethSupportsNativeShapeShift()
  }

  public ethGetAccountPaths (msg: ETHGetAccountPath): Array<ETHAccountPath> {
    return this.info.ethGetAccountPaths(msg)
  }
}

export function info (): TrezorHDWalletInfo {
  return new TrezorHDWalletInfo()
}

export function create (transport: TrezorTransport, debuglink: boolean): TrezorHDWallet {
  return new TrezorHDWallet(transport)
}