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
} from '@shapeshiftoss/hdwallet-core'
import { trezor_handleError } from './utils'
import {
  trezor_btcSupportsCoin,
  trezor_btcSupportsScriptType,
  trezor_btcGetAddress,
  trezor_btcSignTx,
  trezor_btcSupportsSecureTransfer,
  trezor_btcSupportsNativeShapeShift,
  trezor_btcSignMessage,
  trezor_btcVerifyMessage,
  trezor_btcGetAccountPaths,
  trezor_btcIsSameAccount, 
} from './bitcoin'
import {
  trezor_ethSignTx,
  trezor_ethGetAddress,
  trezor_ethSignMessage,
  trezor_ethVerifyMessage,
  trezor_ethSupportsNetwork,
  trezor_ethSupportsSecureTransfer,
  trezor_ethSupportsNativeShapeShift,
  trezor_ethGetAccountPaths,
} from './ethereum'
import { TrezorTransport } from './transport'

export function isTrezor(wallet: HDWallet): wallet is TrezorHDWallet {
  return typeof wallet === 'object' && wallet._isTrezor !== undefined
}

export class TrezorHDWallet extends HDWallet implements BTCWallet, ETHWallet {
  _supportsBTC: boolean = true
  _supportsETH: boolean = true
  _isTrezor: boolean = true
  transport: TrezorTransport
  featuresCache: any

  constructor(transport: TrezorTransport) {
    super()
    this.transport = transport
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
    trezor_handleError(this.transport, res, "Could not get Trezor features")
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
    trezor_handleError(this.transport, res, "Could not load xpubs from Trezor")
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
    trezor_handleError(this.transport, res, "Could not wipe Trezor")
  }

  public async reset (msg: ResetDevice): Promise<void> {
    let res = await this.transport.call('resetDevice', {
      strength: msg.entropy,
      label: msg.label,
      pinProtection: msg.pin,
      passphraseProtection: msg.passphrase
    })
    trezor_handleError(this.transport, res, "Could not reset Trezor")
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
    trezor_handleError(this.transport, res, "Could not load seed into Trezor")
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
    return trezor_btcSupportsCoin(coin)
  }

  public async btcSupportsScriptType (coin: Coin, scriptType: BTCInputScriptType): Promise<boolean> { 
    return trezor_btcSupportsScriptType(coin, scriptType)
  }

  public async btcGetAddress (msg: BTCGetAddress): Promise<string> {
    return trezor_btcGetAddress(this.transport, msg)
  }

  public async btcSignTx (msg: BTCSignTx): Promise<BTCSignedTx> {
    return trezor_btcSignTx(this, this.transport, msg)
  }

  public async btcSupportsSecureTransfer (): Promise<boolean> {
    return trezor_btcSupportsSecureTransfer()
  }

  public async btcSupportsNativeShapeShift (): Promise<boolean> {
    return trezor_btcSupportsNativeShapeShift()
  }

  public async btcSignMessage (msg: BTCSignMessage): Promise<BTCSignedMessage> {
    return trezor_btcSignMessage(this.transport, msg)
  }

  public async btcVerifyMessage (msg: BTCVerifyMessage): Promise<boolean> {
    return trezor_btcVerifyMessage(this.transport, msg)
  }

  public btcGetAccountPaths (msg: BTCGetAccountPaths): Array<BTCAccountPath> {
    return trezor_btcGetAccountPaths(msg)
  }

  public btcIsSameAccount (msg: Array<BTCAccountPath>): boolean {
    return trezor_btcIsSameAccount(msg)
  }


  public async ethSignTx (msg: ETHSignTx): Promise<ETHSignedTx> {
    return trezor_ethSignTx(this, this.transport, msg)
  }

  public async ethGetAddress (msg: ETHGetAddress): Promise<string> {
    return trezor_ethGetAddress(this.transport, msg)
  }

  public async ethSignMessage (msg: ETHSignMessage): Promise<ETHSignedMessage> {
    return trezor_ethSignMessage(this.transport, msg)
  }

  public async ethVerifyMessage (msg: ETHVerifyMessage): Promise<boolean> {
    return trezor_ethVerifyMessage(this.transport, msg)
  }

  public async ethSupportsNetwork (chain_id: number): Promise<boolean> {
    return trezor_ethSupportsNetwork(chain_id)
  }

  public async ethSupportsSecureTransfer (): Promise<boolean> {
    return trezor_ethSupportsSecureTransfer()
  }

  public async ethSupportsNativeShapeShift (): Promise<boolean> {
    return trezor_ethSupportsNativeShapeShift()
  }

  public ethGetAccountPaths (msg: ETHGetAccountPath): Array<ETHAccountPath> {
    return trezor_ethGetAccountPaths(msg)
  }
}

export function create (transport: TrezorTransport, debuglink: boolean): TrezorHDWallet {
  return new TrezorHDWallet(transport)
}