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
  BIP32Path,
  slip44ByCoin,
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
  fromHexString

} from "@shapeshiftoss/hdwallet-core"
import { verify } from 'bitcoinjs-message'
import Base64 from 'base64-js'
import { payments } from 'bitcoinjs-lib'
import { fromBase58 } from 'bip32'

function describeETHPath (path: BIP32Path): PathDescription {
  let pathStr = addressNListToBIP32(path)
  let unknown: PathDescription = {
    verbose: pathStr,
    coin: 'Ethereum',
    isKnown: false
  }

  if (path.length !== 5)
    return unknown

  if (path[0] !== 0x80000000 + 44)
    return unknown

  if (path[1] !== 0x80000000 + slip44ByCoin('Ethereum'))
    return unknown

  if ((path[2] & 0x80000000) >>> 0 !== 0x80000000)
    return unknown

  if (path[3] !== 0)
    return unknown

  if (path[4] !== 0)
    return unknown

  let index = path[2] & 0x7fffffff
  return {
    verbose: `Ethereum Account #${index}`,
    accountIdx: index,
    wholeAccount: true,
    coin: 'Ethereum',
    isKnown: true
  }
}

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
  return typeof wallet === 'object' && (wallet as any)._isPortis === true
}

export class PortisHDWallet implements HDWallet, ETHWallet, BTCWallet {

  // btc stuff


  public async btcGetAddress (msg: BTCGetAddress): Promise<string> {
    
    const change = msg.addressNList[3]
    const index = msg.addressNList[4]

    const b32string = addressNListToBIP32(msg.addressNList)
    const hardPath = b32string.slice(0, b32string.lastIndexOf(`'`)+1)

    const { result: xpub} = await this.portis.getExtendedPublicKey(hardPath, "Bitcoin")

    const { address } = payments.p2pkh({pubkey: fromBase58(xpub).derive(change).derive(index).publicKey})

    if(msg.showDisplay === true) {
      this.portis.showPortis()
    }
    return address
  }

  public async btcSignTx (msg: BTCSignTx): Promise<BTCSignedTx> {
    return {
      signatures: ['signature1', 'signature2', 'signature3'],
      serializedTx: 'serialized tx'
    }
  }

  public async btcSignMessage (msg: BTCSignMessage): Promise<BTCSignedMessage> {
    // portis doesnt support this for btc
    return undefined
  }

  public async btcVerifyMessage (msg: BTCVerifyMessage): Promise<boolean> {
    const signature = Base64.fromByteArray(fromHexString(msg.signature))

    console.log('signature is', signature)
    return verify(msg.message, msg.address, signature)
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

  public async btcSupportsNativeShapeShift (): Promise<boolean> {
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


  // eth stuff

  _supportsETH: boolean = true
  _supportsETHInfo: boolean = true
  _supportsBTCInfo: boolean = true
  _supportsBTC: boolean = true
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

  public async hasOnDevicePinEntry(): Promise<boolean> {
    return this.info.hasOnDevicePinEntry()
  }

  public async hasOnDevicePassphrase(): Promise<boolean> {
    return this.info.hasOnDevicePassphrase()
  }

  public async hasOnDeviceDisplay(): Promise<boolean> {
    return this.info.hasOnDeviceDisplay()
  }

  public async hasOnDeviceRecovery(): Promise<boolean> {
    return this.info.hasOnDeviceRecovery()
  }

  public async hasNativeShapeShift(
    srcCoin: Coin,
    dstCoin: Coin
  ): Promise<boolean> {
    return false
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

  public async ethSupportsNetwork (chainId: number = 1): Promise<boolean> {
    return this.info.ethSupportsNetwork(chainId)
  }

  public async ethSupportsSecureTransfer (): Promise<boolean> {
    return this.info.ethSupportsSecureTransfer()
  }

  public async ethSupportsNativeShapeShift (): Promise<boolean> {
    return this.info.ethSupportsNativeShapeShift()
  }

  public async ethVerifyMessage (msg: ETHVerifyMessage): Promise<boolean> {
    const signingAddress = await this.web3.eth.accounts.recover(msg.message, ('0x' + msg.signature), false)
    return signingAddress === msg.address
  }

  public describePath (msg: DescribePath): PathDescription {
    switch (msg.coin) {
    case 'Ethereum':
      return describeETHPath(msg.path)
    default:
      throw new Error("Unsupported path")
    }
  }

  public ethNextAccountPath (msg: ETHAccountPath): ETHAccountPath | undefined {
    // Portis only supports one account for eth
    return undefined
  }

  public async isInitialized (): Promise<boolean> {
    return true
  }

  public disconnect (): Promise<void> {
    return Promise.resolve()
  }

  public async getPublicKeys(msg: GetPublicKey[]): Promise<PublicKey[]> {
    const publicKeys = []
    this.portisCallInProgress = new Promise( async (resolve, reject) => {
      try {
          await this.portisCallInProgress
      } catch (e) {
          console.error(e)
      }
      for (let i = 0; i < msg.length; i++) {
        const { addressNList } = msg[i];
        console.log('addressNList', addressNList)
        const portisResult = await this.portis.getExtendedPublicKey(addressNListToBIP32(addressNList))
        const { result, error } = portisResult
        if(error)
          reject(error)
        publicKeys.push({ xpub: result })
      }
      resolve(publicKeys)
    })
    return this.portisCallInProgress
  }

  public async ethSignTx (msg: ETHSignTx): Promise<ETHSignedTx> {
    const from = await this._ethGetAddress()
    const result = await this.web3.eth.signTransaction({
      from,
      to: msg.to,
      value: msg.value,
      gas: msg.gasLimit,
      gasPrice: msg.gasPrice,
      data: msg.data,
      nonce: msg.nonce
    })
    return {
        v: result.tx.v,
        r: result.tx.r,
        s:  result.tx.s,
        serialized: result.raw
    } 
  }

  public async ethSignMessage (msg: ETHSignMessage): Promise<ETHSignedMessage> {

    const address = await this._ethGetAddress()
    const result = await this.web3.eth.sign(msg.message, address)
    return {
      address,
      signature: result
    }
  }

  public ethGetAccountPaths (msg: ETHGetAccountPath): Array<ETHAccountPath> {
    return [{
      addressNList: [ 0x80000000 + 44, 0x80000000 + slip44ByCoin(msg.coin), 0x80000000 + msg.accountIdx, 0, 0 ],
      hardenedPath: [ 0x80000000 + 44, 0x80000000 + slip44ByCoin(msg.coin), 0x80000000 + msg.accountIdx ],
      relPath: [ 0, 0 ],
      description: "Portis"
    }]
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

  private async _ethGetAddress(): Promise<string> {
    if(!this.ethAddress) {
      this.ethAddress = (await this.web3.eth.getAccounts())[0]
    }
    return this.ethAddress
  }

  public async getFirmwareVersion(): Promise<string> {
    return 'portis'
  }
}

export class PortisHDWalletInfo implements HDWalletInfo, ETHWalletInfo, BTCWalletInfo {

  // btc stuff

  public async btcSupportsCoin (coin: Coin): Promise<boolean> {

    if(coin === 'Bitcoin')
      return Promise.resolve(true)
    else
      return Promise.resolve(false)
  }

  // TODO figure out what script types portis supports
  public async btcSupportsScriptType (coin: Coin, scriptType: BTCInputScriptType): Promise<boolean> {

    if(coin === 'Bitcoin' && scriptType === BTCInputScriptType.SpendAddress)
      return Promise.resolve(true)
    else
      return Promise.resolve(false)
  }

  public async btcSupportsSecureTransfer (): Promise<boolean> {
    return Promise.resolve(false)
  }

  public async btcSupportsNativeShapeShift (): Promise<boolean> {
    return Promise.resolve(false)
  }

  public btcGetAccountPaths (msg: BTCGetAccountPaths): Array<BTCAccountPath> {
    const slip44 = slip44ByCoin(msg.coin)
    const bip44 = {
      coin: msg.coin,
      scriptType: BTCInputScriptType.SpendAddress,
      addressNList: [0x80000000 + 44, 0x80000000 + slip44, 0x80000000 + msg.accountIdx]
    }    
    return [ bip44 ]
  }

  public btcIsSameAccount (msg: Array<BTCAccountPath>): boolean {
    return false
  }

  // TODO figure out if this is relevent to portis
  public btcNextAccountPath (msg: BTCAccountPath): BTCAccountPath | undefined {
    return undefined
  }

  // eth stuff

  _supportsBTCInfo: boolean = true
  _supportsETHInfo: boolean = true

  public getVendor (): string {
    return "Portis"
  }

  public async ethSupportsNetwork (chainId: number = 1): Promise<boolean> {
    return chainId === 1
  }

  public async ethSupportsSecureTransfer (): Promise<boolean> {
    return false
  }

  public async ethSupportsNativeShapeShift (): Promise<boolean> {
    return false
  }

  public ethGetAccountPaths (msg: ETHGetAccountPath): Array<ETHAccountPath> {
    return [{
      addressNList: [ 0x80000000 + 44, 0x80000000 + slip44ByCoin(msg.coin), 0x80000000 + msg.accountIdx, 0, 0 ],
      hardenedPath: [ 0x80000000 + 44, 0x80000000 + slip44ByCoin(msg.coin), 0x80000000 + msg.accountIdx ],
      relPath: [ 0, 0 ],
      description: "Portis"
    }]
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
    return true
  }

  public async hasNativeShapeShift (srcCoin: Coin, dstCoin: Coin): Promise<boolean> {
    // It doesn't... yet?
    return false
  }

  public describePath (msg: DescribePath): PathDescription {
    switch (msg.coin) {
      case 'Ethereum':
        return describeETHPath(msg.path)
      default:
        throw new Error("Unsupported path")
      }
  }

  public ethNextAccountPath (msg: ETHAccountPath): ETHAccountPath | undefined {
    // Portis only supports one account for eth
    return undefined
  }
}

export function info () {
  return new PortisHDWalletInfo()
}

export type Portis = any

export function create (portis: Portis): PortisHDWallet {
  return new PortisHDWallet(portis)
}
