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
  applyMixins,
} from '@shapeshiftoss/hdwallet-core'
import { TrezorBTCWallet } from './bitcoin'
import { TrezorETHWallet } from './ethereum'
import { TrezorTransport } from './transport'
import { TrezorDebugLinkWallet } from './debuglink'

export function isTrezor(wallet: any): wallet is TrezorHDWallet {
  return typeof wallet === 'object' && wallet._isTrezor !== undefined
}

export class TrezorHDWallet extends HDWallet {
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
    this.handleError(res, "Could not get Trezor features")
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
    this.handleError(res, "Could not load xpubs from Trezor")
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
    this.handleError(res, "Could not wipe Trezor")
  }

  public async reset (msg: ResetDevice): Promise<void> {
    let res = await this.transport.call('resetDevice', {
      strength: msg.entropy,
      label: msg.label,
      pinProtection: msg.pin,
      passphraseProtection: msg.passphrase
    })
    this.handleError(res, "Could not reset Trezor")
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
    this.handleError(res, "Could not load seed into Trezor")
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

  protected handleError (result: any, message: string): void {
    if (result.success)
      return

    if (result.payload.code === "Failure_ActionCancelled")
      throw new ActionCancelled()

    if (result.payload.error === "device disconnected during action" ||
        result.payload.error === "Device disconnected")
      throw new DeviceDisconnected()

    if (result.payload.error === "Popup closed")
      throw new PopupClosedError()

    throw new Error(`${message}: '${result.payload.error}'`)
  }
}

export interface TrezorHDWallet extends TrezorBTCWallet, TrezorETHWallet, TrezorDebugLinkWallet {}

let mixinsApplied = false

export function create (transport: TrezorTransport, debuglink: boolean): TrezorHDWallet {
  if (!mixinsApplied) {
    applyMixins(TrezorHDWallet, [TrezorBTCWallet, TrezorETHWallet, TrezorDebugLinkWallet])
    mixinsApplied = true
  }
  let wallet = <TrezorHDWallet>new TrezorHDWallet(transport)
  wallet._supportsBTC = true
  wallet._supportsETH = true
  return wallet
}