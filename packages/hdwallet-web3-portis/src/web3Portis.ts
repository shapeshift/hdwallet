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
    ETHSignedTx
  } from "@shapeshiftoss/hdwallet-core";
      
  import { PortisTransport } from './portisTransport'

  export class Web3PortisHDWallet implements HDWallet, ETHWallet {
    _supportsETH: boolean = true
    _supportsETHInfo: boolean = true
    _supportsBTCInfo: boolean = false
    _supportsBTC: boolean = false
    _supportsDebugLink: boolean = false
    _isKeepKey: boolean = false
    _isLedger: boolean = false
    _isTrezor: boolean = false

    // unused but required by HDWallet interface
    transport: PortisTransport
    
    portis: any
    constructor(portis, transport) {
      console.log('Web3PortisHDWallet constructor called')
      this.transport = transport
      this.portis = portis
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
  
    public async ethSupportsNetwork (chain_id: number): Promise<boolean> {
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
    


    // TODO Methods below must be implemented

    getPublicKeys(msg: GetPublicKey[]): Promise<PublicKey[]> {
      console.log('GET PUBLIC KEYS')
      throw new Error("getPublicKeys Method not implemented.");
    }
  
    public ethGetAccountPaths (msg: ETHGetAccountPath): Array<ETHAccountPath> {
      console.log('Web3PortisHDWallet ethGetAccountPaths')
      return []
    }
  
    public async ethSignTx (msg: ETHSignTx): Promise<ETHSignedTx> {
        return {
            v: 1,
            r: 'r',
            s:  's',
            serialized: 'serialized tx'
        } 
    }
  
    public async ethGetAddress (msg: ETHGetAddress): Promise<string> {
      return '0x1234567'
    }s
  
    public async ethSignMessage (msg: ETHSignMessage): Promise<ETHSignedMessage> {
      return {
        address: '0x1234567',
        signature: 'signature'
      }
    }

    public async getDeviceID(): Promise<string> {
      console.log('web3Portis getDeviceID')
      return 'web3deviceId'
    }

  }
  