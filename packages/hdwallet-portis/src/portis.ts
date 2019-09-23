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
  slip44ByCoin
} from "@shapeshiftoss/hdwallet-core";
      
  import { getPortisEthAddress } from './utils'

  import Web3 from 'web3'

  function describeETHPath (path: BIP32Path): PathDescription {
    let pathStr = addressNListToBIP32(path)
    let unknown: PathDescription = {
      verbose: pathStr,
      coin: 'Ethereum',
      isKnown: false
    }
  
    if (path.length != 5)
      return unknown
  
    if (path[0] != 0x80000000 + 44)
      return unknown
  
    if (path[1] != 0x80000000 + slip44ByCoin('Ethereum'))
      return unknown
  
    if ((path[2] & 0x80000000) >>> 0 !== 0x80000000)
      return unknown
  
    if (path[3] != 0)
      return unknown
  
    if (path[4] != 0)
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
  
  export class PortisHDWallet implements HDWallet, ETHWallet {
    _supportsETH: boolean = true
    _supportsETHInfo: boolean = true
    _supportsBTCInfo: boolean = false
    _supportsBTC: boolean = false
    _supportsDebugLink: boolean = false
    _isKeepKey: boolean = false
    _isLedger: boolean = false
    _isTrezor: boolean = false

    transport = null
    
    portis: any
    web3: any

    constructor(portis) {
      console.log('Web3PortisHDWallet constructor called')
      this.portis = portis
      this.web3 = new Web3(portis.provider);
    }
  
    public async isLocked(): Promise<boolean> {
      console.log('web3Portis isLocked')
      return false;
    }
  
    public getVendor(): string {
      console.log('web3Portis getVendor')
      return "web3vendor"
    }

    public async getModel(): Promise<string> {
      console.log('web3Portis getModel')
      return 'web3model'
    }
  
    public async getLabel(): Promise<string> {
      console.log('web3Portis getLabel')
      return 'web3label'
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
    
    // TODO Methods below must be implemented

    public async isInitialized (): Promise<boolean> {
      console.log('Web3PortisHDWallet isInitialized')
      return false
    }

    public disconnect (): Promise<void> {
      console.log('Web3PortisHDWallet disconnect')
      return Promise.resolve()
    }

    public getPublicKeys(msg: GetPublicKey[]): Promise<PublicKey[]> {
      console.log('GET PUBLIC KEYS')

      this.portis.getExtendedPublicKey("m/44'/60'/0'").then(({ error, result }) => {
        console.log(error, 'RESULT PUB KEYS IS ', result);
      });

      return Promise.resolve([{
        xpub: 'xpub'
      }])
    }
  
    public ethGetAccountPaths (msg: ETHGetAccountPath): Array<ETHAccountPath> {
      console.log('Web3PortisHDWallet ethGetAccountPaths')
      return []
    }
  
    public async ethSignTx (msg: ETHSignTx): Promise<ETHSignedTx> {
      console.log('Web3PortisHDWallet ethSignTx')
        return {
            v: 1,
            r: 'r',
            s:  's',
            serialized: 'serialized tx'
        } 
    }
  
    public async ethSignMessage (msg: ETHSignMessage): Promise<ETHSignedMessage> {
      console.log('Web3PortisHDWallet ethSignMessage')
      return {
        address: await getPortisEthAddress(this.portis),
        signature: 'signature'
      }
    }

    public async ethGetAddress (msg: ETHGetAddress): Promise<string> {
      console.log('Web3PortisHDWallet ethGetAddress')
      return getPortisEthAddress(this.portis)
    }

    public async getDeviceID(): Promise<string> {
      console.log('Web3PortisHDWallet getDeviceID')
      return getPortisEthAddress(this.portis)
    }
  }
  