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
  Constructor,
  makeEvent,
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
  return typeof wallet === 'object' && wallet._isLedger !== undefined
}

export class LedgerHDWallet implements HDWallet, BTCWallet, ETHWallet {
  _supportsDebugLink: boolean = false
  _supportsBTC: boolean = true
  _supportsETH: boolean = true
  _isKeepKey: boolean = false
  _isTrezor: boolean = false
  _isLedger: boolean = true
  transport: LedgerTransport

  constructor (transport: LedgerTransport) {
    this.transport = transport
  }

  public async initialize (): Promise<any> {
    return
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
    return
  }

  public async isLocked (): Promise<boolean> {
    return true;
  }

  public async clearSession (): Promise<void> {
    return
  }

  // TODO: what to do with Ethereum?
  // Adapted from https://github.com/LedgerHQ/ledger-wallet-webtool
  public async getPublicKeys (msg: Array<GetPublicKey>): Promise<Array<PublicKey>> {
    const xpubs = []
    for (const getPublicKey of msg) {
      const { addressNList } = getPublicKey
      const bip32path: string = addressNListToBIP32(addressNList.slice(0, 3)).substring(2)
      const prevBip32path: string = addressNListToBIP32(addressNList.slice(0, 2)).substring(2)
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
      const fingerprint: number = ((result[0] << 24) | (result[1] << 16) | (result[2] << 8) | result[3]) >>> 0

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
    return Btc.btcSupportsCoin(coin)
  }

  public async btcSupportsScriptType (coin: Coin, scriptType: BTCInputScriptType): Promise<boolean> { 
    return Btc.btcSupportsScriptType(coin, scriptType)
  }

  public async btcGetAddress (msg: BTCGetAddress): Promise<string> {
    return Btc.btcGetAddress(this.transport, msg)
  }

  public async btcSignTx (msg: BTCSignTx): Promise<BTCSignedTx> {
    return Btc.btcSignTx(this, this.transport, msg)
  }

  public async btcSupportsSecureTransfer (): Promise<boolean> {
    return Btc.btcSupportsSecureTransfer()
  }

  public async btcSupportsNativeShapeShift (): Promise<boolean> {
    return Btc.btcSupportsNativeShapeShift()
  }

  public async btcSignMessage (msg: BTCSignMessage): Promise<BTCSignedMessage> {
    return Btc.btcSignMessage(this, this.transport, msg)
  }

  public async btcVerifyMessage (msg: BTCVerifyMessage): Promise<boolean> {
    return Btc.btcVerifyMessage(msg)
  }

  public btcGetAccountPaths (msg: BTCGetAccountPaths): Array<BTCAccountPath> {
    return Btc.btcGetAccountPaths(msg)
  }

  public btcIsSameAccount (msg: Array<BTCAccountPath>): boolean {
    return Btc.btcIsSameAccount(msg)
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
}

export function create (transport: LedgerTransport): LedgerHDWallet {
  return new LedgerHDWallet(transport)
}
