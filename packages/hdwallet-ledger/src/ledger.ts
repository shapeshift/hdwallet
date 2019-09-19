import { crypto } from 'bitcoinjs-lib'
import * as core from '@shapeshiftoss/hdwallet-core'
import { handleError } from './utils'
import * as btc from './bitcoin'
import * as eth from './ethereum'
import { LedgerTransport } from './transport'
import {
  compressPublicKey,
  createXpub,
  encodeBase58Check,
  networksUtil,
  parseHexString,
  translateScriptType
} from './utils'

export function isLedger (wallet: core.HDWallet): wallet is LedgerHDWallet {
  return typeof wallet === 'object' && wallet._isLedger === true
}

export class LedgerHDWalletInfo implements core.HDWalletInfo, core.BTCWalletInfo, core.ETHWalletInfo {
  _supportsBTCInfo: boolean = true
  _supportsETHInfo: boolean = true

  public getVendor (): string {
    return "Ledger"
  }

  public async btcSupportsCoin (coin: core.Coin): Promise<boolean> {
    return btc.btcSupportsCoin(coin)
  }

  public async btcSupportsScriptType (coin: core.Coin, scriptType: core.BTCInputScriptType): Promise<boolean> {
    return btc.btcSupportsScriptType(coin, scriptType)
  }

  public async btcSupportsSecureTransfer (): Promise<boolean> {
    return btc.btcSupportsSecureTransfer()
  }

  public async btcSupportsNativeShapeShift (): Promise<boolean> {
    return btc.btcSupportsNativeShapeShift()
  }

  public btcGetAccountPaths (msg: core.BTCGetAccountPaths): Array<core.BTCAccountPath> {
    return btc.btcGetAccountPaths(msg)
  }

  public btcIsSameAccount (msg: Array<core.BTCAccountPath>): boolean {
    return btc.btcIsSameAccount(msg)
  }

  public async ethSupportsNetwork (chain_id: number): Promise<boolean> {
    return eth.ethSupportsNetwork(chain_id)
  }

  public async ethSupportsSecureTransfer (): Promise<boolean> {
    return eth.ethSupportsSecureTransfer()
  }

  public async ethSupportsNativeShapeShift (): Promise<boolean> {
    return eth.ethSupportsNativeShapeShift()
  }

  public ethGetAccountPaths (msg: core.ETHGetAccountPath): Array<core.ETHAccountPath> {
    return eth.ethGetAccountPaths(msg)
  }

  public async hasNativeShapeShift (srcCoin: core.Coin, dstCoin: core.Coin): Promise<boolean> {
    return false
  }

  public async hasOnDeviceDisplay (): Promise<boolean> {
    return true
  }

  public async hasOnDevicePassphrase (): Promise<boolean> {
    return true
  }

  public async hasOnDevicePinEntry (): Promise<boolean> {
    return true
  }

  public async hasOnDeviceRecovery (): Promise<boolean> {
    return true
  }
}

export class LedgerHDWallet implements core.HDWallet, core.BTCWallet, core.ETHWallet {
  _supportsETHInfo: boolean = true
  _supportsBTCInfo: boolean = true
  _supportsDebugLink: boolean = false
  _supportsBTC: boolean = true
  _supportsETH: boolean = true

  _isKeepKey: boolean = false
  _isTrezor: boolean = false
  _isLedger: boolean = true

  transport: LedgerTransport
  info: LedgerHDWalletInfo & core.HDWalletInfo

  constructor (transport: LedgerTransport) {
    this.transport = transport
    this.info = new LedgerHDWalletInfo()
  }

  public async initialize (): Promise<any> {
    return
  }

  public async clearSession (): Promise<void> {
    return
  }

  public async getLabel (): Promise<string> {
    return
  }

  public async getDeviceID (): Promise<string> {
    const { device: { deviceID }} = this.transport as any
    return deviceID
  }

  public getVendor (): string {
    return "Ledger"
  }

  public async getModel (): Promise<string> {
    const { device: { productName }} = this.transport as any
    return "Ledger " + productName
  }

  public async isLocked (): Promise<boolean> {
    return true
  }

  // TODO: what to do with Ethereum?
  // Adapted from https://github.com/LedgerHQ/ledger-wallet-webtool
  public async getPublicKeys (msg: Array<core.GetPublicKey>): Promise<Array<core.PublicKey>> {
    const xpubs = []
    for (const getPublicKey of msg) {
      const { addressNList } = getPublicKey
      const bip32path: string = core.addressNListToBIP32(addressNList.slice(0, 3)).substring(2)
      const prevBip32path: string = core.addressNListToBIP32(addressNList.slice(0, 2)).substring(2)
      const format: string = translateScriptType(getPublicKey.scriptType) || 'legacy'
      const opts = {
        verify: false,
        format
      }
      const res1 = await this.transport.call('Btc', 'getWalletPublicKey', prevBip32path, opts)
      handleError(this.transport, res1, 'Unable to obtain public key from device.')

      let { payload: { publicKey } } = res1
      publicKey = compressPublicKey(publicKey)
      publicKey = parseHexString(publicKey)
      let result = crypto.sha256(publicKey)

      result = crypto.ripemd160(result)

      const fingerprint = result[0] << 24 | result[1] << 16 | result[2] << 8 | result[3] >>> 0

      const res2 = await this.transport.call('Btc', 'getWalletPublicKey', bip32path, opts)
      handleError(this.transport, res2, 'Unable to obtain public key from device.')

      publicKey = res2.payload.publicKey
      const chainCode: string = res2.payload.chainCode
      publicKey = compressPublicKey(publicKey)
      const coinType: number = parseInt(bip32path.split("/")[1], 10)
      const account: number = parseInt(bip32path.split("/")[2], 10)
      const childNum: number = (0x80000000 | account) >>> 0
      let xpub = createXpub(
        3,
        fingerprint,
        childNum,
        chainCode,
        publicKey,
        networksUtil[coinType].bitcoinjs.bip32.public
      )
      xpub = encodeBase58Check(xpub)

      xpubs.push({
        xpub
      })
    }
    return xpubs
  }

  public async hasNativeShapeShift (srcCoin: core.Coin, dstCoin: core.Coin): Promise<boolean> {
    return false
  }

  public async hasOnDeviceDisplay (): Promise<boolean> {
    return true
  }

  public async hasOnDevicePassphrase (): Promise<boolean> {
    return true
  }

  public async hasOnDevicePinEntry (): Promise<boolean> {
    return true
  }

  public async hasOnDeviceRecovery (): Promise<boolean> {
    return true
  }

  public async loadDevice (msg: core.LoadDevice): Promise<void> {
    return
  }

  public async ping (msg: core.Ping): Promise<core.Pong> {
    // Ledger doesn't have this, faking response here
    return { msg: msg.msg }
  }

  public async cancel (): Promise<void> {
    return
  }

  public async recover (msg: core.RecoverDevice): Promise<void> {
    return
  }

  public async reset (msg: core.ResetDevice): Promise<void> {
    return
  }

  public async sendCharacter (character: string): Promise<void> {
    return
  }

  public async sendPassphrase (passphrase: string): Promise<void> {
    return
  }

  public async sendPin (pin: string): Promise<void> {
    return
  }

  public async sendWord (word: string): Promise<void> {
    return
  }

  public async wipe (): Promise<void> {
    return
  }

  public async btcSupportsCoin (coin: core.Coin): Promise<boolean> {
    return this.info.btcSupportsCoin(coin)
  }

  public async btcSupportsScriptType (coin: core.Coin, scriptType: core.BTCInputScriptType): Promise<boolean> {
    return this.info.btcSupportsScriptType(coin, scriptType)
  }

  public async btcGetAddress (msg: core.BTCGetAddress): Promise<string> {
    return btc.btcGetAddress(this.transport, msg)
  }

  public async btcSignTx (msg: core.BTCSignTx): Promise<core.BTCSignedTx> {
    return btc.btcSignTx(this, this.transport, msg)
  }

  public async btcSupportsSecureTransfer (): Promise<boolean> {
    return this.info.btcSupportsSecureTransfer()
  }

  public async btcSupportsNativeShapeShift (): Promise<boolean> {
    return this.info.btcSupportsNativeShapeShift()
  }

  public async btcSignMessage (msg: core.BTCSignMessage): Promise<core.BTCSignedMessage> {
    return btc.btcSignMessage(this, this.transport, msg)
  }

  public async btcVerifyMessage (msg: core.BTCVerifyMessage): Promise<boolean> {
    return btc.btcVerifyMessage(msg)
  }

  public btcGetAccountPaths (msg: core.BTCGetAccountPaths): Array<core.BTCAccountPath> {
    return this.info.btcGetAccountPaths(msg)
  }

  public btcIsSameAccount (msg: Array<core.BTCAccountPath>): boolean {
    return this.info.btcIsSameAccount(msg)
  }

  public async ethSignTx (msg: core.ETHSignTx): Promise<core.ETHSignedTx> {
    return eth.ethSignTx(this.transport, msg)
  }

  public async ethGetAddress (msg: core.ETHGetAddress): Promise<string> {
    return eth.ethGetAddress(this.transport, msg)
  }

  public async ethSignMessage (msg: core.ETHSignMessage): Promise<core.ETHSignedMessage> {
    return eth.ethSignMessage(this.transport, msg)
  }

  public async ethVerifyMessage (msg: core.ETHVerifyMessage): Promise<boolean> {
    return eth.ethVerifyMessage(msg)
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

  public ethGetAccountPaths (msg: core.ETHGetAccountPath): Array<core.ETHAccountPath> {
    return this.info.ethGetAccountPaths(msg)
  }
}

export function info (): LedgerHDWalletInfo {
  return new LedgerHDWalletInfo()
}

export function create (transport: LedgerTransport): LedgerHDWallet {
  return new LedgerHDWallet(transport)
}
