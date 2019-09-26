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
  Keyring
} from "@shapeshiftoss/hdwallet-core"
      
  import Web3 from 'web3'

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
      return '0'
    }

    public call (...args: any[]): Promise<any> {
      return Promise.resolve()
    }
  
  }

  
  export class PortisHDWallet implements HDWallet, ETHWallet {
    _supportsETH: boolean = true
    _supportsETHInfo: boolean = true
    _supportsBTCInfo: boolean = false
    _supportsBTC: boolean = false
    _supportsDebugLink: boolean = false
    _isKeepKey: boolean = false
    _isLedger: boolean = false
    _isTrezor: boolean = false

    transport = new PortisTransport(new Keyring())
    
    portis: any
    web3: any

    constructor(portis) {
      console.log('Web3PortisHDWallet constructor called')
      this.portis = portis
      this.web3 = new Web3(portis.provider);
    }
  
    public async isLocked(): Promise<boolean> {
      console.log('portis isLocked')
      return false;
    }
  
    public getVendor(): string {
      console.log('web3Portis getVendor')
      return "portisvendor"
    }

    public async getModel(): Promise<string> {
      console.log('web3Portis getModel')
      return 'portismodel'
    }
  
    public async getLabel(): Promise<string> {
      console.log('web3Portis getLabel')
      return 'Portis'
    }
  
    public async initialize(): Promise<void> {
        
        console.log('Web3PortisHDWallet initialize called')
    }
  
    public async hasOnDevicePinEntry(): Promise<boolean> {
      console.log('Web3PortisHDWallet hasOnDevicePinEntry')
      return true;
    }
  
    public async hasOnDevicePassphrase(): Promise<boolean> {
      console.log('Web3PortisHDWallet hasOnDevicePassphrase')
      return true;
    }
  
    public async hasOnDeviceDisplay(): Promise<boolean> {
      console.log('Web3PortisHDWallet hasOnDeviceDisplay')
      return true;
    }
  
    public async hasOnDeviceRecovery(): Promise<boolean> {
      console.log('Web3PortisHDWallet hasOnDeviceRecovery')
      return true;
    }
  
    public async hasNativeShapeShift(
      srcCoin: Coin,
      dstCoin: Coin
    ): Promise<boolean> {
      console.log('Web3PortisHDWallet hasNativeShapeShift')
      return false;
    }
  
    clearSession(): Promise<void> {
      console.log('Web3PortisHDWallet clearSession')
      throw new Error("Method not implemented.");
    }
    ping(msg: Ping): Promise<Pong> {
      console.log('Web3PortisHDWallet ping')
      throw new Error("Method not implemented.");
    }
    sendPin(pin: string): Promise<void> {
      console.log('Web3PortisHDWallet sendPin')
      throw new Error("Method not implemented.");
    }
    sendPassphrase(passphrase: string): Promise<void> {
      console.log('Web3PortisHDWallet sendPassphrase')
      throw new Error("Method not implemented.");
    }
    sendCharacter(charater: string): Promise<void> {
      console.log('Web3PortisHDWallet sendCharacter')
      throw new Error("Method not implemented.");
    }
    sendWord(word: string): Promise<void> {
      console.log('Web3PortisHDWallet sendWord')
      throw new Error("Method not implemented.");
    }
    cancel(): Promise<void> {
      console.log('Web3PortisHDWallet cancel')
      throw new Error("Method not implemented.");
    }
    wipe(): Promise<void> {
      console.log('Web3PortisHDWallet wipe')
      throw new Error("Method not implemented.");
    }
    reset(msg: ResetDevice): Promise<void> {
      console.log('Web3PortisHDWallet reset')
      throw new Error("Method not implemented.");
    }
    recover(msg: RecoverDevice): Promise<void> {
      console.log('Web3PortisHDWallet recover')
      throw new Error("Method not implemented.");
    }
    loadDevice(msg: LoadDevice): Promise<void> {
      console.log('Web3PortisHDWallet loadDevice')
      throw new Error("Method not implemented.");
    }
  
    public async ethSupportsNetwork (chain_id: number = 1): Promise<boolean> {
      console.log('Web3PortisHDWallet ethSupportsNetwork')
      return true
    }
  
    public async ethSupportsSecureTransfer (): Promise<boolean> {
      console.log('Web3PortisHDWallet ethSupportsSecureTransfer')
      return false
    }
  
    public async ethSupportsNativeShapeShift (): Promise<boolean> {
      console.log('Web3PortisHDWallet ethSupportsNativeShapeShift')
      return false
    }

    public async ethVerifyMessage (msg: ETHVerifyMessage): Promise<boolean> {
      console.log('Web3PortisHDWallet ethSupportsNativeShapeShift')
      return false
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
    
    // TODO Methods below must be implemented

    public async isInitialized (): Promise<boolean> {
      console.log('Web3PortisHDWallet isInitialized')
      return false
    }

    public disconnect (): Promise<void> {
      console.log('Web3PortisHDWallet disconnect')
      return Promise.resolve()
    }

    // TODO this needs to handle more than just eth
    public async getPublicKeys(msg: GetPublicKey[]): Promise<PublicKey[]> {
      console.log('GET PUBLIC KEYS')
      const portisResult = await this.portis.getExtendedPublicKey("m/44'/60'/0'")
      const { result, error } = portisResult
      if (result) {
        return [{ xpub: result }]
      }
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
      console.log('Web3PortisHDWallet ethSignMessage')

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
      console.log('Web3PortisHDWallet ethGetAddress')
      return this._ethGetAddress()
    }

    public async getDeviceID(): Promise<string> {
      console.log('Web3PortisHDWallet getDeviceID')
      return this._ethGetAddress()
    }

    private async _ethGetAddress(): Promise<string> {
      return (await this.web3.eth.getAccounts())[0]
    }
  }
  
