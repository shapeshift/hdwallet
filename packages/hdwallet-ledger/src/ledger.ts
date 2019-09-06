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
import { ledger_handleError } from './utils'
import {
  ledger_btcSupportsCoin,
  ledger_btcSupportsScriptType,
  ledger_btcGetAddress,
  ledger_btcSignTx,
  ledger_btcSupportsSecureTransfer,
  ledger_btcSupportsNativeShapeShift,
  ledger_btcSignMessage,
  ledger_btcVerifyMessage,
  ledger_btcGetAccountPaths,
  ledger_btcIsSameAccount, 
} from './bitcoin'
import {
  ledger_ethSignTx,
  ledger_ethGetAddress,
  ledger_ethSignMessage,
  ledger_ethVerifyMessage,
  ledger_ethSupportsNetwork,
  ledger_ethSupportsSecureTransfer,
  ledger_ethSupportsNativeShapeShift,
  ledger_ethGetAccountPaths,
} from './ethereum'
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

export class LedgerHDWallet extends HDWallet implements BTCWallet, ETHWallet {
  _supportsBTC: boolean = true
  _supportsETH: boolean = true
  _isLedger: boolean = true
  transport: LedgerTransport

  constructor (transport: LedgerTransport) {
    super()
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
      ledger_handleError(this.transport, res1, 'Unable to obtain public key from device.')

      let { payload: { publicKey } } = res1
      publicKey = compressPublicKey(publicKey)
      publicKey = parseHexString(publicKey)
      let result = crypto.sha256(publicKey)

      result = crypto.ripemd160(result)
      const fingerprint: number = ((result[0] << 24) | (result[1] << 16) | (result[2] << 8) | result[3]) >>> 0

      const res2 = await this.transport.call('Btc', 'getWalletPublicKey', bip32path, opts)
      ledger_handleError(this.transport, res2, 'Unable to obtain public key from device.')

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
    return ledger_btcSupportsCoin(coin)
  }

  public async btcSupportsScriptType (coin: Coin, scriptType: BTCInputScriptType): Promise<boolean> { 
    return ledger_btcSupportsScriptType(coin, scriptType)
  }

  public async btcGetAddress (msg: BTCGetAddress): Promise<string> {
    return ledger_btcGetAddress(this.transport, msg)
  }

  public async btcSignTx (msg: BTCSignTx): Promise<BTCSignedTx> {
    return ledger_btcSignTx(this, this.transport, msg)
  }

  public async btcSupportsSecureTransfer (): Promise<boolean> {
    return ledger_btcSupportsSecureTransfer()
  }

  public async btcSupportsNativeShapeShift (): Promise<boolean> {
    return ledger_btcSupportsNativeShapeShift()
  }

  public async btcSignMessage (msg: BTCSignMessage): Promise<BTCSignedMessage> {
    return ledger_btcSignMessage(this, this.transport, msg)
  }

  public async btcVerifyMessage (msg: BTCVerifyMessage): Promise<boolean> {
    return ledger_btcVerifyMessage(msg)
  }

  public btcGetAccountPaths (msg: BTCGetAccountPaths): Array<BTCAccountPath> {
    return ledger_btcGetAccountPaths(msg)
  }

  public btcIsSameAccount (msg: Array<BTCAccountPath>): boolean {
    return ledger_btcIsSameAccount(msg)
  }


  public async ethSignTx (msg: ETHSignTx): Promise<ETHSignedTx> {
    return ledger_ethSignTx(this.transport, msg)
  }

  public async ethGetAddress (msg: ETHGetAddress): Promise<string> {
    return ledger_ethGetAddress(this.transport, msg)
  }

  public async ethSignMessage (msg: ETHSignMessage): Promise<ETHSignedMessage> {
    return ledger_ethSignMessage(this.transport, msg)
  }

  public async ethVerifyMessage (msg: ETHVerifyMessage): Promise<boolean> {
    return ledger_ethVerifyMessage(msg)
  }

  public async ethSupportsNetwork (chain_id: number): Promise<boolean> {
    return ledger_ethSupportsNetwork(chain_id)
  }

  public async ethSupportsSecureTransfer (): Promise<boolean> {
    return ledger_ethSupportsSecureTransfer()
  }

  public async ethSupportsNativeShapeShift (): Promise<boolean> {
    return ledger_ethSupportsNativeShapeShift()
  }

  public ethGetAccountPaths (msg: ETHGetAccountPath): Array<ETHAccountPath> {
    return ledger_ethGetAccountPaths(msg)
  }
}

export function create (transport: LedgerTransport): LedgerHDWallet {
  return new LedgerHDWallet(transport)
}
