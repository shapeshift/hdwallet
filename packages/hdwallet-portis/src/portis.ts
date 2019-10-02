import * as eventemitter2 from 'eventemitter2'
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
  ETHWalletInfo
} from "@shapeshiftoss/hdwallet-core"

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

export class PortisHDWallet implements HDWallet, ETHWallet {
  _supportsETH: boolean = true
  _supportsETHInfo: boolean = true
  _supportsBTCInfo: boolean = false
  _supportsBTC: boolean = false
  _supportsDebugLink: boolean = false
  _isPortis: boolean = true

  transport = new PortisTransport(new Keyring())
  
  portis: any
  web3: any

  // used as a mutex to ensure calls to portis.getExtendedPublicKey cannot happen before a previous call has resolved
  xpubCallInProgress: Promise<any> = Promise.resolve()

  constructor(portis) {
    this.portis = portis
    this.web3 = new Web3(portis.provider);
  }

  public async isLocked(): Promise<boolean> {
    return false;
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
    return false;
  }

  public async hasOnDevicePassphrase(): Promise<boolean> {
    return true;
  }

  public async hasOnDeviceDisplay(): Promise<boolean> {
    return true;
  }

  public async hasOnDeviceRecovery(): Promise<boolean> {
    return true;
  }

  public async hasNativeShapeShift(
    srcCoin: Coin,
    dstCoin: Coin
  ): Promise<boolean> {
    return false;
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

  public async ethSupportsNetwork (chain_id: number = 1): Promise<boolean> {
    return true
  }

  public async ethSupportsSecureTransfer (): Promise<boolean> {
    return false
  }

  public async ethSupportsNativeShapeShift (): Promise<boolean> {
    return false
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
      throw new Error("Unsupported path");
    }
  }

  public ethNextAccountPath (msg: ETHAccountPath): ETHAccountPath | undefined {
    // Portis only supports one account for eth
    return undefined
  }

  public async isInitialized (): Promise<boolean> {
    return false
  }

  public disconnect (): Promise<void> {
    return Promise.resolve()
  }

  public async getPublicKeys(msg: GetPublicKey[]): Promise<PublicKey[]> {
    const publicKeys = []
    this.xpubCallInProgress = new Promise( async (resolve, reject) => {
      await this.xpubCallInProgress
      for (let i = 0; i < msg.length; i++) {
        const { addressNList } = msg[i];
        const portisResult = await this.portis.getExtendedPublicKey(addressNListToBIP32(addressNList))
        const { result, error } = portisResult
        if(error) {
          return reject(error)
        }
        publicKeys.push({ xpub: result })
      }
      resolve(publicKeys)
    })
    return this.xpubCallInProgress
  }

  public async ethSignTx (msg: ETHSignTx): Promise<ETHSignedTx> {
    const result = await this.web3.eth.signTransaction({
      from: await this._ethGetAddress(),
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
    return this._ethGetAddress()
  }

  public async getDeviceID(): Promise<string> {
    return 'portis:' + (await this._ethGetAddress())
  }

  private async _ethGetAddress(): Promise<string> {
    return (await this.web3.eth.getAccounts())[0]
  }

  public async getFirmwareVersion(): Promise<string> {
    return 'portis'
  }
}

export class PortisHDWalletInfo implements HDWalletInfo, ETHWalletInfo {
  _supportsBTCInfo: boolean = false
  _supportsETHInfo: boolean = true

  public getVendor (): string {
    return "Portis"
  }

  public async ethSupportsNetwork (chain_id: number = 1): Promise<boolean> {
    return chain_id === 1
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
    return false
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

export function create (portis): PortisHDWallet {
  return new PortisHDWallet(portis)
}
