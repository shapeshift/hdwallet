import * as core from "@shapeshiftoss/hdwallet-core";
import * as eth from "./ethereum";
import * as bitcoin from "./bitcoin";
import _ from "lodash";

class XDeFiTransport extends core.Transport {
  public async getDeviceID() {
    return "xdefi:0";
  }

  public async call(...args: any[]): Promise<any> {}
}

export function isXDeFi(wallet: core.HDWallet): wallet is XDeFiHDWallet {
  return _.isObject(wallet) && (wallet as any)._isXDEFI;
}

export class XDeFiHDWallet implements core.HDWallet, core.ETHWallet, core.BTCWallet {
  readonly _supportsETH = true;
  readonly _supportsETHInfo = true;
  readonly _isXDEFI = true;
  readonly _supportsBTCInfo = true;
  readonly _supportsBTC = true;

  transport: core.Transport = new XDeFiTransport(new core.Keyring());
  info: XDeFiHDWalletInfo & core.HDWalletInfo;
  ethAddress?: string | null;
  bitcoinAddress?: string | null;
  litecoinAddress?: string | null;
  bchAddress?: string | null;
  provider!: { [key: string]: any };

  constructor() {
    this.info = new XDeFiHDWalletInfo();
  }

  async getFeatures(): Promise<Record<string, any>> {
    return {};
  }

  public async isLocked(): Promise<boolean> {
    return !this.provider?.xdefi.isUnlocked();
  }

  public getVendor(): string {
    return "XDeFi";
  }

  public async getModel(): Promise<string> {
    return "XDeFi";
  }

  public async getLabel(): Promise<string> {
    return "XDeFi";
  }

  public initialize(): never;
  public initialize(provider: { [key: string]: any }): Promise<void>;
  public async initialize(provider?: { [key: string]: any }): Promise<void> {
    if ((provider && Object.keys(provider).length === 0) || !provider) throw new Error("provider is required");
    this.provider! = provider;
  }

  public async resetWallet() {
    this.ethAddress = null;
    this.bitcoinAddress = null;
    this.litecoinAddress = null;
    this.bchAddress = null;
  }

  public hasOnDevicePinEntry(): boolean {
    return this.info.hasOnDevicePinEntry();
  }

  public hasOnDevicePassphrase(): boolean {
    return this.info.hasOnDevicePassphrase();
  }

  public hasOnDeviceDisplay(): boolean {
    return this.info.hasOnDeviceDisplay();
  }

  public hasOnDeviceRecovery(): boolean {
    return this.info.hasOnDeviceRecovery();
  }

  public hasNativeShapeShift(srcCoin: core.Coin, dstCoin: core.Coin): boolean {
    return this.info.hasNativeShapeShift(srcCoin, dstCoin);
  }

  public supportsOfflineSigning(): boolean {
    return false;
  }

  public supportsBroadcast(): boolean {
    return true;
  }

  public async clearSession(): Promise<void> {
    // TODO: Can we lock XDeFi from here?
  }

  public async ping(msg: core.Ping): Promise<core.Pong> {
    // no ping function for XDeFi, so just returning Core.Pong
    return { msg: msg.msg };
  }

  public async sendPin(pin: string): Promise<void> {
    // no concept of pin in XDeFi
  }

  public async sendPassphrase(passphrase: string): Promise<void> {
    // cannot send passphrase to XDeFi. Could show the widget?
  }

  public async sendCharacter(charater: string): Promise<void> {
    // no concept of sendCharacter in XDeFi
  }

  public async sendWord(word: string): Promise<void> {
    // no concept of sendWord in XDeFi
  }

  public async cancel(): Promise<void> {
    // no concept of cancel in XDeFi
  }

  public async wipe(): Promise<void> {}

  public async reset(msg: core.ResetDevice): Promise<void> {}

  public async recover(msg: core.RecoverDevice): Promise<void> {
    // no concept of recover in XDeFi
  }

  public async loadDevice(msg: core.LoadDevice): Promise<void> {
    // TODO: Does XDeFi allow this to be done programatically?
  }

  public describePath(msg: core.DescribePath): core.PathDescription {
    return this.info.describePath(msg);
  }

  public async getPublicKeys(msg: Array<core.GetPublicKey>): Promise<Array<core.PublicKey | null>> {
    // Ethereum public keys are not exposed by the RPC API
    return [];
  }

  public async isInitialized(): Promise<boolean> {
    return true;
  }

  public async disconnect(): Promise<void> {}

  public async btcGetAddress(msg?: core.BTCGetAddress): Promise<string | null> {
    if (!msg) {
      return this.getBitcoinAddress();
    }
    const { coin } = msg;

    switch (coin.toLowerCase()) {
      case "bitcoin":
        return this.getBitcoinAddress();
      case "litecoin":
        return this.getLitecoinAddress();
      case "bitcoincash":
        return this.getbchAddress();
      default:
        throw new Error(`${coin} not supported`);
    }
  }

  private getBitcoinAddress = async (): Promise<string | null> => {
    if (this.bitcoinAddress) return this.bitcoinAddress;
    const address = await bitcoin.btcGetAddress(this.provider?.["bitcoin"]);
    if (address) {
      this.bitcoinAddress = address;
      return address;
    }
    return null;
  };
  private getLitecoinAddress = async (): Promise<string | null> => {
    if (this.litecoinAddress) return this.litecoinAddress;
    const address = await bitcoin.btcGetAddress(this.provider?.["litecoin"]);
    if (address) {
      this.litecoinAddress = address;
      return address;
    }
    return null;
  };
  private getbchAddress = async (): Promise<string | null> => {
    if (this.bchAddress) return this.bchAddress;
    const address = await bitcoin.btcGetAddress(this.provider?.["bitcoincash"]);
    if (address) {
      this.bchAddress = address;
      return address;
    }
    return null;
  };
  public async btcSignTx(msg: core.BTCSignTx): Promise<core.BTCSignedTx | null> {
    let address;
    switch (msg.coin.toLowerCase()) {
      case "bitcoin":
        address = await this.getBitcoinAddress();
        break;
      case "litecoin":
        address = await this.getLitecoinAddress();
        break;
      case "bitcoincash":
        address = await this.getbchAddress();
        break;
      default:
        throw new Error(`Unable to get address for ${msg.coin}`);
    }
    return address ? bitcoin.btcSignTx(msg, address, this.provider?.[msg.coin.toLowerCase()]) : null;
  }
  public async btcSignMessage(msg: core.BTCSignMessage): Promise<core.BTCSignedMessage | null> {
    let address;
    switch (msg.coin.toLowerCase()) {
      case "bitcoin":
        address = await this.getBitcoinAddress();
        break;
      case "litecoin":
        address = await this.getLitecoinAddress();
        break;
      case "bitcoincash":
        address = await this.getbchAddress();
        break;
      default:
        throw new Error(`Unable to get address for ${msg.coin}`);
    }

    return address ? bitcoin.btcSignMessage(msg, address, this.provider?.[msg.coin.toLowerCase()]) : null;
  }
  public async btcVerifyMessage(msg: core.BTCVerifyMessage): Promise<boolean | null> {
    return bitcoin.btcVerifyMessage(msg);
  }
  public async btcSupportsCoin(coin: string): Promise<boolean> {
    return bitcoin.btcSupportsCoin(coin);
  }
  public btcSupportsScriptType(coin: string, scriptType?: core.BTCInputScriptType): Promise<boolean> {
    return bitcoin.btcSupportsScriptType(coin, scriptType);
  }
  public async btcSupportsSecureTransfer(): Promise<boolean> {
    return false;
  }
  public btcSupportsNativeShapeShift(): boolean {
    return false;
  }
  public btcGetAccountPaths(msg: core.BTCGetAccountPaths): core.BTCAccountPath[] {
    return bitcoin.btcGetAccountPaths(msg);
  }
  public btcIsSameAccount(msg: core.BTCAccountPath[]): boolean {
    return false;
  }
  public btcNextAccountPath(msg: core.BTCAccountPath): core.BTCAccountPath | undefined {
    return undefined;
  }

  public async ethSupportsNetwork(chainId: number = 1): Promise<boolean> {
    return chainId === 1;
  }

  public async ethSupportsSecureTransfer(): Promise<boolean> {
    return false;
  }

  public ethSupportsNativeShapeShift(): boolean {
    return false;
  }

  public async ethSupportsEIP1559(): Promise<boolean> {
    return true;
  }

  public ethGetAccountPaths(msg: core.ETHGetAccountPath): Array<core.ETHAccountPath> {
    return eth.ethGetAccountPaths(msg);
  }

  public ethNextAccountPath(msg: core.ETHAccountPath): core.ETHAccountPath | undefined {
    return this.info.ethNextAccountPath(msg);
  }

  public async ethGetAddress(): Promise<string | null> {
    if (this.ethAddress) {
      return this.ethAddress;
    }
    const address = await eth.ethGetAddress(this.provider?.["ethereum"]);
    if (address) {
      this.ethAddress = address;
      return address;
    } else {
      this.ethAddress = null;
      return null;
    }
  }

  public async ethSignTx(msg: core.ETHSignTx): Promise<core.ETHSignedTx | null> {
    const address = await this.ethGetAddress();
    return address ? eth.ethSignTx(msg, this.provider?.["ethereum"], address) : null;
  }

  public async ethSendTx(msg: core.ETHSignTx): Promise<core.ETHTxHash | null> {
    const address = await this.ethGetAddress();
    return address ? eth.ethSendTx(msg, this.provider?.["ethereum"], address) : null;
  }

  public async ethSignMessage(msg: core.ETHSignMessage): Promise<core.ETHSignedMessage | null> {
    const address = await this.ethGetAddress();
    return address ? eth.ethSignMessage(msg, this.provider?.["ethereum"], address) : null;
  }

  public async ethVerifyMessage(msg: core.ETHVerifyMessage): Promise<boolean | null> {
    return eth.ethVerifyMessage(msg, this.provider?.["ethereum"]);
  }

  public async getDeviceID(): Promise<string> {
    return "xDeFi:" + (await this.ethGetAddress());
  }

  public async getFirmwareVersion(): Promise<string> {
    return "xDeFi";
  }
}

export class XDeFiHDWalletInfo implements core.HDWalletInfo, core.ETHWalletInfo, core.BTCWalletInfo {
  readonly _supportsETHInfo = true;
  readonly _supportsBTCInfo = true;

  public getVendor(): string {
    return "XDeFi";
  }

  public hasOnDevicePinEntry(): boolean {
    return false;
  }

  public hasOnDevicePassphrase(): boolean {
    return false;
  }

  public hasOnDeviceDisplay(): boolean {
    return false;
  }

  public hasOnDeviceRecovery(): boolean {
    return false;
  }

  public hasNativeShapeShift(): boolean {
    return false;
  }

  public supportsOfflineSigning(): boolean {
    return false;
  }

  public supportsBroadcast(): boolean {
    return true;
  }

  public describePath(msg: core.DescribePath): core.PathDescription {
    switch (msg.coin) {
      case "Ethereum":
        return core.describeETHPath(msg.path);
      default:
        throw new Error("Unsupported path");
    }
  }

  btcSupportsCoin(coin: string): Promise<boolean> {
    return bitcoin.btcSupportsCoin(coin);
  }
  btcSupportsScriptType(coin: string, scriptType?: core.BTCInputScriptType): Promise<boolean> {
    return bitcoin.btcSupportsScriptType(coin, scriptType);
  }
  async btcSupportsSecureTransfer(): Promise<boolean> {
    return false;
  }
  btcSupportsNativeShapeShift(): boolean {
    return false;
  }
  btcGetAccountPaths(msg: core.BTCGetAccountPaths): core.BTCAccountPath[] {
    return bitcoin.btcGetAccountPaths(msg);
  }
  btcIsSameAccount(msg: core.BTCAccountPath[]): boolean {
    return false;
  }
  btcNextAccountPath(msg: core.BTCAccountPath): core.BTCAccountPath | undefined {
    return undefined;
  }

  public ethNextAccountPath(msg: core.ETHAccountPath): core.ETHAccountPath | undefined {
    // TODO: What do we do here?
    return undefined;
  }

  public async ethSupportsNetwork(chainId: number = 1): Promise<boolean> {
    return chainId === 1;
  }

  public async ethSupportsSecureTransfer(): Promise<boolean> {
    return false;
  }

  public ethSupportsNativeShapeShift(): boolean {
    return false;
  }

  public async ethSupportsEIP1559(): Promise<boolean> {
    return true;
  }

  public ethGetAccountPaths(msg: core.ETHGetAccountPath): Array<core.ETHAccountPath> {
    return eth.ethGetAccountPaths(msg);
  }
}

export function info() {
  return new XDeFiHDWalletInfo();
}

export function create(): XDeFiHDWallet {
  return new XDeFiHDWallet();
}
