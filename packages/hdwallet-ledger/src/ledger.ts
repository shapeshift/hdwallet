import { crypto } from 'bitcoinjs-lib'
import * as core from '@shapeshiftoss/hdwallet-core'
import { handleError } from './utils'
import * as btc from './bitcoin'
import * as eth from './ethereum'
import { LedgerTransport } from './transport'
import {
  appsUtil,
  compressPublicKey,
  createXpub,
  encodeBase58Check,
  networksUtil,
  parseHexString
} from './utils'
import { isObject } from 'lodash'

export function isLedger (wallet: core.HDWallet): wallet is LedgerHDWallet {
  return isObject(wallet) && (wallet as any)._isLedger === true
}

function describeETHPath (path: core.BIP32Path): core.PathDescription {
  let pathStr = core.addressNListToBIP32(path)
  let unknown: core.PathDescription = {
    verbose: pathStr,
    coin: 'Ethereum',
    isKnown: false
  }

  if (path.length !== 5 && path.length !== 4)
    return unknown

  if (path[0] !== 0x80000000 + 44)
    return unknown

  if (path[1] !== 0x80000000 + core.slip44ByCoin('Ethereum'))
    return unknown

  if ((path[2] & 0x80000000) >>> 0 !== 0x80000000)
    return unknown

  let accountIdx
  if (path.length === 5) {
    if (path[3] !== 0)
      return unknown

    if (path[4] !== 0)
      return unknown

    accountIdx = (path[2] & 0x7fffffff) >>> 0
  } else if (path.length === 4) {
    if (path[2] !== 0x80000000)
      return unknown

    if ((path[3] & 0x80000000) >>> 0 === 0x80000000)
      return unknown


    accountIdx = path[3]
  } else {
    return unknown
  }

  return {
    verbose: `Ethereum Account #${accountIdx}`,
    wholeAccount: true,
    accountIdx,
    coin: 'Ethereum',
    isKnown: true,
    isPrefork: false,
  }
}

function describeUTXOPath (path: core.BIP32Path, coin: core.Coin, scriptType: core.BTCInputScriptType) {
  let pathStr = core.addressNListToBIP32(path)
  let unknown: core.PathDescription = {
    verbose: pathStr,
    coin,
    scriptType,
    isKnown: false
  }

  if (!btc.btcSupportsCoin(coin))
    return unknown

  if (!btc.btcSupportsScriptType(coin, scriptType))
    return unknown

  if (path.length !== 3 && path.length !== 5)
    return unknown

  if ((path[0] & 0x80000000) >>> 0 !== 0x80000000)
    return unknown

  let purpose = path[0] & 0x7fffffff

  if (![44, 49, 84].includes(purpose))
    return unknown

  if (purpose === 44 && scriptType !== core.BTCInputScriptType.SpendAddress)
    return unknown

  if (purpose === 49 && scriptType !== core.BTCInputScriptType.SpendP2SHWitness)
    return unknown

  if (purpose === 84 && scriptType !== core.BTCInputScriptType.SpendWitness)
    return unknown

  if (path[1] !== 0x80000000 + core.slip44ByCoin(coin))
    return unknown

  let wholeAccount = path.length === 3

  let script = {
    [core.BTCInputScriptType.SpendAddress]: ' (Legacy)',
    [core.BTCInputScriptType.SpendP2SHWitness]: '',
    [core.BTCInputScriptType.SpendWitness]: ' (Segwit Native)'
  }[scriptType]

  switch (coin) {
  case 'Bitcoin':
  case 'Litecoin':
  case 'BitcoinGold':
  case 'Testnet':
    break;
  default:
    script = ''
  }

  let accountIdx = path[2] & 0x7fffffff

  if (wholeAccount) {
    return {
      verbose: `${coin} Account #${accountIdx}${script}`,
      accountIdx,
      coin,
      scriptType,
      wholeAccount: true,
      isKnown: true,
      isPrefork: false,
    }
  } else {
    let change = path[3] == 1 ? 'Change ' : ''
    let addressIdx = path[4]
    return {
      verbose: `${coin} Account #${accountIdx}, ${change}Address #${addressIdx}${script}`,
      coin,
      scriptType,
      accountIdx,
      addressIdx,
      wholeAccount: false,
      isChange: path[3] == 1,
      isKnown: true,
      isPrefork: false,
    }
  }
}

export class LedgerHDWalletInfo implements core.HDWalletInfo, core.BTCWalletInfo, core.ETHWalletInfo {
  _supportsBTCInfo: boolean = true
  _supportsETHInfo: boolean = true

  public getVendor (): string {
    return 'Ledger'
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

  public describePath (msg: core.DescribePath): core.PathDescription {
    switch (msg.coin) {
    case 'Ethereum':
      return describeETHPath(msg.path)
    default:
      return describeUTXOPath(msg.path, msg.coin, msg.scriptType)
    }
  }

  public btcNextAccountPath (msg: core.BTCAccountPath): core.BTCAccountPath | undefined {
    let description = describeUTXOPath(msg.addressNList, msg.coin, msg.scriptType)
    if (!description.isKnown) {
      return undefined
    }

    let addressNList = msg.addressNList

    if (addressNList[0] === 0x80000000 + 44 ||
        addressNList[0] === 0x80000000 + 49 ||
        addressNList[0] === 0x80000000 + 84) {
      addressNList[2] += 1
      return {
        ...msg,
        addressNList
      }
    }

    return undefined
  }

  public ethNextAccountPath (msg: core.ETHAccountPath): core.ETHAccountPath | undefined {
    let addressNList = msg.hardenedPath.concat(msg.relPath)
    let description = describeETHPath(addressNList)
    if (!description.isKnown) {
      return undefined
    }

    if (description.wholeAccount) {
      addressNList[2] += 1
      return {
        ...msg,
        addressNList,
        hardenedPath: core.hardenedPath(addressNList),
        relPath: core.relativePath(addressNList)
      }
    }

    if (addressNList.length === 5) {
      addressNList[2] += 1
      return {
        ...msg,
        hardenedPath: core.hardenedPath(addressNList),
        relPath: core.relativePath(addressNList)
      }
    }

    if (addressNList.length === 4) {
      addressNList[3] += 1
      return {
        ...msg,
        hardenedPath: core.hardenedPath(addressNList),
        relPath: core.relativePath(addressNList)
      }
    }

    return undefined
  }
}

export class LedgerHDWallet implements core.HDWallet, core.BTCWallet, core.ETHWallet {
  _supportsETHInfo: boolean = true
  _supportsBTCInfo: boolean = true
  _supportsDebugLink: boolean = false
  _supportsBTC: boolean = true
  _supportsETH: boolean = true

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

  public async isInitialized (): Promise<boolean> {
    // AFAICT, there isn't an API to figure this out, so we go with a reasonable
    // (ish) default:
    return true
  }

  public async getDeviceID (): Promise<string> {
    const { device: { serialNumber: deviceID }} = this.transport as any
    return deviceID
  }

  public async getFeatures (): Promise<any> {
    const res = await this.transport.call(null, 'getDeviceInfo')
    handleError(res, this.transport)
    return res.payload
  }

  /**
   * Validates current app open
   * Throws WrongApp error if symbol does not match app
   * @param symbol - i.e. 'BCH'
   * @returns {Promise<void>}
   */
  public async validateCurrentApp (symbol: string): Promise<void> {
    symbol = symbol && symbol.toUpperCase()
    const res = await this.transport.call(null, 'getAppAndVersion')
    handleError(res, this.transport)
    const { name: currentApp } = res.payload
    const expectedApp = appsUtil[symbol]
    if (currentApp !== expectedApp) {
      throw new core.WrongApp('Ledger', expectedApp)
    }
  }

  /**
   * Prompt user to open given app on device
   * User must be in dashboard
   * @param appName - human-readable app name i.e. "Bitcoin Cash"
   */
  public async openApp (appName: string): Promise<void> {
    const res = await this.transport.call(null, 'openApp', appName)
    handleError(res, this.transport)
  }

  public async getFirmwareVersion (): Promise<string> {
    const { version } = await this.getFeatures()
    return version
  }

  public getVendor (): string {
    return "Ledger"
  }

  public async getModel (): Promise<string> {
    const { device: { productName }} = this.transport as any
    return productName
  }

  public async getLabel (): Promise<string> {
    return 'Ledger'
  }

  public async isLocked (): Promise<boolean> {
    return true
  }

  public async clearSession (): Promise<void> {
    return
  }

  // Adapted from https://github.com/LedgerHQ/ledger-wallet-webtool
  public async getPublicKeys (msg: Array<core.GetPublicKey>): Promise<Array<core.PublicKey>> {
    const xpubs = []

    for (const getPublicKey of msg) {
      let { addressNList, coin, scriptType } = getPublicKey

      const parentBip32path: string = core.addressNListToBIP32(addressNList.slice(0, -1)).substring(2) // i.e. "44'/0'"

      const opts = { verify: false }

      const res1 = await this.transport.call('Btc', 'getWalletPublicKey', parentBip32path, opts)
      handleError(res1, this.transport, 'Unable to obtain public key from device.')

      let { payload: { publicKey: parentPublicKey } } = res1
      parentPublicKey = parseHexString(compressPublicKey(parentPublicKey))

      let result = crypto.sha256(parentPublicKey)
      result = crypto.ripemd160(result)

      const fingerprint: number = ((result[0] << 24) | (result[1] << 16) | (result[2] << 8) | result[3]) >>> 0
      const bip32path: string = core.addressNListToBIP32(addressNList).substring(2) // i.e 44'/0'/0'

      const res2 = await this.transport.call('Btc', 'getWalletPublicKey', bip32path, opts)
      handleError(res2, this.transport, 'Unable to obtain public key from device.')

      let { payload: { publicKey, chainCode } } = res2
      publicKey = compressPublicKey(publicKey)

      const coinDetails: any = networksUtil[core.slip44ByCoin(coin)]
      const childNum: number = addressNList[addressNList.length -1]

      scriptType = scriptType || core.BTCInputScriptType.SpendAddress
      const networkMagic = coinDetails.bitcoinjs.bip32.public[scriptType]

      const xpub = createXpub(
        3,
        fingerprint,
        childNum,
        chainCode,
        publicKey,
        networkMagic
      )

      xpubs.push({ xpub: encodeBase58Check(xpub) })
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

  // Ledger doesn't have this, faking response here
  public async ping (msg: core.Ping): Promise<core.Pong> {
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

  public describePath (msg: core.DescribePath): core.PathDescription {
    return this.info.describePath(msg)
  }

  public disconnect (): Promise<void> {
    return this.transport.disconnect()
  }

  public btcNextAccountPath (msg: core.BTCAccountPath): core.BTCAccountPath | undefined {
    return this.info.btcNextAccountPath(msg)
  }

  public ethNextAccountPath (msg: core.ETHAccountPath): core.ETHAccountPath | undefined {
    return this.info.ethNextAccountPath(msg)
  }
}

export function info (): LedgerHDWalletInfo {
  return new LedgerHDWalletInfo()
}

export function create (transport: LedgerTransport): LedgerHDWallet {
  return new LedgerHDWallet(transport)
}
