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
    Transport,
    ETHSignedTx
  } from "@shapeshiftoss/hdwallet-core";
      
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
    transport: Transport = null

    
    account: string // ETH Address
  
    constructor() {
        console.log('Web3PortisHDWallet constructor called')
    }
  
    public async isLocked(): Promise<boolean> {
        return false;
    }

    public async getDeviceID(): Promise<string> {
      return 'web3deviceId'
    }
  
    public getVendor(): string {
      return "web3vendor"
    }

    public async getModel(): Promise<string> {
      return 'web3model'
    }
  
    public async getLabel(): Promise<string> {
      return 'web3label'
    }
  
    public async initialize(): Promise<void> {
        console.log('Web3PortisHDWallet initialize called')
    }
  
    public async hasOnDevicePinEntry(): Promise<boolean> {
      return true;
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
  
    getPublicKeys(msg: GetPublicKey[]): Promise<PublicKey[]> {
      console.log('GET PUBLIC KEYS')
      throw new Error("Method not implemented.");
    }
    clearSession(): Promise<void> {
      throw new Error("Method not implemented.");
    }
    ping(msg: Ping): Promise<Pong> {
      throw new Error("Method not implemented.");
    }
    sendPin(pin: string): Promise<void> {
      throw new Error("Method not implemented.");
    }
    sendPassphrase(passphrase: string): Promise<void> {
      throw new Error("Method not implemented.");
    }
    sendCharacter(charater: string): Promise<void> {
      throw new Error("Method not implemented.");
    }
    sendWord(word: string): Promise<void> {
      throw new Error("Method not implemented.");
    }
    cancel(): Promise<void> {
      throw new Error("Method not implemented.");
    }
    wipe(): Promise<void> {
      throw new Error("Method not implemented.");
    }
    reset(msg: ResetDevice): Promise<void> {
      throw new Error("Method not implemented.");
    }
    recover(msg: RecoverDevice): Promise<void> {
      throw new Error("Method not implemented.");
    }
    loadDevice(msg: LoadDevice): Promise<void> {
      throw new Error("Method not implemented.");
    }
  
    public async ethSupportsNetwork (chain_id: number): Promise<boolean> {
      return true
    }
  
    public async ethSupportsSecureTransfer (): Promise<boolean> {
      return false
    }
  
    public async ethSupportsNativeShapeShift (): Promise<boolean> {
      return false
    }
  
    public ethGetAccountPaths (msg: ETHGetAccountPath): Array<ETHAccountPath> {
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
      return this.account
    }
  
    public async ethSignMessage (msg: ETHSignMessage): Promise<ETHSignedMessage> {
      let res = await this.transport.call('send', {
        method: 'personal_sign',
        params: {
          account: this.account,
          data: msg.message
    }
      })
      return {
        address: this.account,
        signature: res.data
      }
    }
  
    public async ethVerifyMessage (msg: ETHVerifyMessage): Promise<boolean> {
      return false
    }
  }
  
  export function create(): Web3PortisHDWallet {
    return new Web3PortisHDWallet()
  }