import { crypto } from 'bitcoinjs-lib'
import {
  addressNListToBIP32,
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
  BIP32Path,
  slip44ByCoin,
  DescribePath,
  PathDescription,
  hardenedPath,
  relativePath,
} from '@shapeshiftoss/hdwallet-core'
import { handleError } from './utils'
import * as Btc from './bitcoin'
import * as Eth from './ethereum'
import { LedgerTransport } from './transport'
import {
  compressPublicKey,
  createXpub,
  encodeBase58Check,
  networksUtil,
  parseHexString,
  translateScriptType
} from './utils'

export function isLedger (wallet: HDWallet): wallet is LedgerHDWallet {
  return typeof wallet === 'object' && wallet._isLedger === true
}

function describeETHPath (path: BIP32Path): PathDescription {
  let pathStr = addressNListToBIP32(path)
  let unknown: PathDescription = {
    verbose: pathStr,
    coin: 'Ethereum',
    isKnown: false
  }

  if (path.length !== 5 && path.length !== 4)
    return unknown

  if (path[0] !== 0x80000000 + 44)
    return unknown

  if (path[1] !== 0x80000000 + slip44ByCoin('Ethereum'))
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
    isKnown: true
  }
}

function describeUTXOPath (path: BIP32Path, coin: Coin, scriptType: BTCInputScriptType) {
  let pathStr = addressNListToBIP32(path)
  let unknown: PathDescription = {
    verbose: pathStr,
    coin,
    scriptType,
    isKnown: false
  }

  if (!Btc.btcSupportsCoin(coin))
    return unknown

  if (!Btc.btcSupportsScriptType(coin, scriptType))
    return unknown

  if (path.length !== 3 && path.length !== 5)
    return unknown

  if ((path[0] & 0x80000000) >>> 0 !== 0x80000000)
    return unknown

  let purpose = path[0] & 0x7fffffff

  if (![44, 49, 84].includes(purpose))
    return unknown

  if (purpose === 44 && scriptType !== BTCInputScriptType.SpendAddress)
    return unknown

  if (purpose === 49 && scriptType !== BTCInputScriptType.SpendP2SHWitness)
    return unknown

  if (purpose === 84 && scriptType !== BTCInputScriptType.SpendWitness)
    return unknown

  if (path[1] !== 0x80000000 + slip44ByCoin(coin))
    return unknown

  let wholeAccount = path.length === 3

  let script = {
    [BTCInputScriptType.SpendAddress]: ' (Legacy)',
    [BTCInputScriptType.SpendP2SHWitness]: '',
    [BTCInputScriptType.SpendWitness]: ' (Segwit Native)'
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
      isKnown: true
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
      isKnown: true
    }
  }
}

export class LedgerHDWalletInfo implements HDWalletInfo, BTCWalletInfo, ETHWalletInfo {
  _supportsBTCInfo: boolean = true
  _supportsETHInfo: boolean = true

  public getVendor (): string {
    return "Ledger"
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

  public async hasNativeShapeShift (srcCoin: Coin, dstCoin: Coin): Promise<boolean> {
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

  public describePath (msg: DescribePath): PathDescription {
    switch (msg.coin) {
    case 'Ethereum':
      return describeETHPath(msg.path)
    default:
      return describeUTXOPath(msg.path, msg.coin, msg.scriptType)
    }
  }

  public btcNextAccountPath (msg: BTCAccountPath): BTCAccountPath | undefined {
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

  public ethNextAccountPath (msg: ETHAccountPath): ETHAccountPath | undefined {
    let addressNList = msg.hardenedPath.concat(msg.relPath)
    let description = describeETHPath(addressNList)
    if (!description.isKnown) {
      return undefined
    }

    if (description.wholeAccount) {
      addressNList[2] += 1
      return {
        ...msg,
        hardenedPath: hardenedPath(addressNList),
        relPath: relativePath(addressNList)
      }
    }

    if (addressNList.length === 5) {
      addressNList[2] += 1
      return {
        ...msg,
        hardenedPath: hardenedPath(addressNList),
        relPath: relativePath(addressNList)
      }
    }

    if (addressNList.length === 4) {
      addressNList[3] += 1
      return {
        ...msg,
        hardenedPath: hardenedPath(addressNList),
        relPath: relativePath(addressNList)
      }
    }

    return undefined
  }
}

export class LedgerHDWallet implements HDWallet, BTCWallet, ETHWallet {
  _supportsETHInfo: boolean = true
  _supportsBTCInfo: boolean = true
  _supportsDebugLink: boolean = false
  _supportsBTC: boolean = true
  _supportsETH: boolean = true
  _isKeepKey: boolean = false
  _isTrezor: boolean = false
  _isLedger: boolean = true

  transport: LedgerTransport
  info: LedgerHDWalletInfo & HDWalletInfo

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
    return this.transport.deviceID
  }

  public getVendor (): string {
    return 'Ledger'
  }

  public async getModel (): Promise<string> {
    return
  }

  public async getLabel (): Promise<string> {
    return 'Ledger'
  }

  public async isLocked (): Promise<boolean> {
    return true;
  }

  public async clearSession (): Promise<void> {
    return
  }

  // Adapted from https://github.com/LedgerHQ/ledger-wallet-webtool
  public async getPublicKeys (msg: Array<GetPublicKey>): Promise<Array<PublicKey>> {
    const xpubs = []
    for (const getPublicKey of msg) {
      const { addressNList, coin } = getPublicKey
      const bip32path: string = addressNListToBIP32(addressNList.slice(0, 3)).substring(2)
      const prevBip32path: string = addressNListToBIP32(addressNList.slice(0, 2)).substring(2)
      const format: string = translateScriptType(getPublicKey.scriptType) || 'legacy'
      const opts = {
        verify: false,
        format
      }

      let res1
      if (coin === 'Ethereum') {
        res1 = await this.transport.call('Btc', 'getWalletPublicKey', prevBip32path)
      } else {
        res1 = await this.transport.call('Btc', 'getWalletPublicKey', prevBip32path, opts)
      }
      handleError(this.transport, res1, 'Unable to obtain public key from device.')

      let { payload: { publicKey } } = res1
      publicKey = compressPublicKey(publicKey)
      publicKey = parseHexString(publicKey)
      let result = crypto.sha256(publicKey)

      result = crypto.ripemd160(result)
      const fingerprint: number = ((result[0] << 24) | (result[1] << 16) | (result[2] << 8) | result[3]) >>> 0

      let res2
      if (coin === 'Ethereum') {
        res2 = await this.transport.call('Btc', 'getWalletPublicKey', bip32path)
      } else {
        res2 = await this.transport.call('Btc', 'getWalletPublicKey', bip32path, opts)
      }
      handleError(this.transport, res2, 'Unable to obtain public key from device.')

      publicKey = res2.payload.publicKey
      const chainCode: string = res2.payload.chainCode
      publicKey = compressPublicKey(publicKey)
      const coinType: number = parseInt(bip32path.split("/")[1], 10)
      const account: number = parseInt(bip32path.split("/")[2], 10)
      const childNum: number = (0x80000000 | account) >>> 0
      const coinDetails = networksUtil[coinType]

      let xpub = createXpub(
        3,
        fingerprint,
        childNum,
        chainCode,
        publicKey,
        coinDetails.bitcoinjs.bip32.public
      )
      xpub = encodeBase58Check(xpub)

      xpubs.push({
        xpub
      })
    }
    return xpubs
  }

  public async hasNativeShapeShift (srcCoin: Coin, dstCoin: Coin): Promise<boolean> {
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

  public async loadDevice (msg: LoadDevice): Promise<void> {
    return
  }

  public async ping (msg: Ping): Promise<Pong> {
    // Ledger doesn't have this, faking response here
    return { msg: msg.msg }
  }

  public async cancel (): Promise<void> {
    return
  }

  public async recover (msg: RecoverDevice): Promise<void> {
    return
  }

  public async reset (msg: ResetDevice): Promise<void> {
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
    return Btc.btcSignMessage(this, this.transport, msg)
  }

  public async btcVerifyMessage (msg: BTCVerifyMessage): Promise<boolean> {
    return Btc.btcVerifyMessage(msg)
  }

  public btcGetAccountPaths (msg: BTCGetAccountPaths): Array<BTCAccountPath> {
    return this.info.btcGetAccountPaths(msg)
  }

  public btcIsSameAccount (msg: Array<BTCAccountPath>): boolean {
    return this.info.btcIsSameAccount(msg)
  }


  public async ethSignTx (msg: ETHSignTx): Promise<ETHSignedTx> {
    return Eth.ethSignTx(this.transport, msg)
  }

  public async ethGetAddress (msg: ETHGetAddress): Promise<string> {
    return Eth.ethGetAddress(this.transport, msg)
  }

  public async ethSignMessage (msg: ETHSignMessage): Promise<ETHSignedMessage> {
    return Eth.ethSignMessage(this.transport, msg)
  }

  public async ethVerifyMessage (msg: ETHVerifyMessage): Promise<boolean> {
    return Eth.ethVerifyMessage(msg)
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

  public describePath (msg: DescribePath): PathDescription {
    return this.info.describePath(msg)
  }

  public disconnect (): Promise<void> {
    return this.transport.disconnect()
  }

  public btcNextAccountPath (msg: BTCAccountPath): BTCAccountPath | undefined {
    return this.info.btcNextAccountPath(msg)
  }

  public ethNextAccountPath (msg: ETHAccountPath): ETHAccountPath | undefined {
    return this.info.ethNextAccountPath(msg)
  }
}

export function info (): LedgerHDWalletInfo {
  return new LedgerHDWalletInfo()
}

export function create (transport: LedgerTransport): LedgerHDWallet {
  return new LedgerHDWallet(transport)
}
