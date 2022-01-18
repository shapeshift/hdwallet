import * as core from "@shapeshiftoss/hdwallet-core";
import * as eth from "./ethereum";
import _ from "lodash";

class XDeFiTransport extends core.Transport {
  public async getDeviceID() {
    return "xdefi:0";
  }

  public call(...args: any[]): Promise<any> {
    return Promise.resolve();
  }
}

export function isXDeFi(wallet: core.HDWallet): wallet is XDeFiHDWallet {
  return _.isObject(wallet) && (wallet as any)._isXDeFi;
}

type HasNonTrivialConstructor<T> = T extends { new (): any } ? never : T;

export class XDeFiHDWallet implements core.HDWallet, core.ETHWallet {
  readonly _supportsETH = true;
  readonly _supportsETHInfo = true;
  readonly _isXDeFi = true;

  transport: core.Transport = new XDeFiTransport(new core.Keyring());
  info: XDeFiHDWalletInfo & core.HDWalletInfo;
  ethAddress?: string | null;
  provider: any;

  constructor() {
    this.info = new XDeFiHDWalletInfo();
  }

  async getFeatures(): Promise<Record<string, any>> {
    return {};
  }

  public async isLocked(): Promise<boolean> {
    return !this.provider.xdefi.isUnlocked();
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

  public async initialize(): Promise<any> {
    try {
      this.provider = (window as any).xfi && (window as any).xfi.ethereum;
    } catch (e) {
      console.error(e);
    }
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

  public ping(msg: core.Ping): Promise<core.Pong> {
    // no ping function for XDeFi, so just returning Core.Pong
    return Promise.resolve({ msg: msg.msg });
  }

  public sendPin(pin: string): Promise<void> {
    // no concept of pin in XDeFi
    return Promise.resolve();
  }

  public sendPassphrase(passphrase: string): Promise<void> {
    // cannot send passphrase to XDeFi. Could show the widget?
    return Promise.resolve();
  }

  public sendCharacter(charater: string): Promise<void> {
    // no concept of sendCharacter in XDeFi
    return Promise.resolve();
  }

  public sendWord(word: string): Promise<void> {
    // no concept of sendWord in XDeFi
    return Promise.resolve();
  }

  public cancel(): Promise<void> {
    // no concept of cancel in XDeFi
    return Promise.resolve();
  }

  public wipe(): Promise<void> {
    return Promise.resolve();
  }

  public reset(msg: core.ResetDevice): Promise<void> {
    return Promise.resolve();
  }

  public recover(msg: core.RecoverDevice): Promise<void> {
    // no concept of recover in XDeFi
    return Promise.resolve();
  }

  public loadDevice(msg: core.LoadDevice): Promise<void> {
    // TODO: Does XDeFi allow this to be done programatically?
    return Promise.resolve();
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

  public disconnect(): Promise<void> {
    return Promise.resolve();
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
    const address = await eth.ethGetAddress(this.provider);
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
    return address ? eth.ethSignTx(msg, this.provider, address) : null;
  }

  public async ethSendTx(msg: core.ETHSignTx): Promise<core.ETHTxHash | null> {
    const address = await this.ethGetAddress();
    return address ? eth.ethSendTx(msg, this.provider, address) : null;
  }

  public async ethSignMessage(msg: core.ETHSignMessage): Promise<core.ETHSignedMessage | null> {
    const address = await this.ethGetAddress();
    return address ? eth.ethSignMessage(msg, this.provider, address) : null;
  }

  public async ethVerifyMessage(msg: core.ETHVerifyMessage): Promise<boolean | null> {
    return eth.ethVerifyMessage(msg, this.provider);
  }

  public async getDeviceID(): Promise<string> {
    return "xDeFi:" + (await this.ethGetAddress());
  }

  public async getFirmwareVersion(): Promise<string> {
    return "xDeFi";
  }
}

export class XDeFiHDWalletInfo implements core.HDWalletInfo, core.ETHWalletInfo {
  readonly _supportsETHInfo = true;

  public getVendor(): string {
    return "XDeFi";
  }

  public hasOnDevicePinEntry(): boolean {
    return false;
  }

  public hasOnDevicePassphrase(): boolean {
    return true;
  }

  public hasOnDeviceDisplay(): boolean {
    return true;
  }

  public hasOnDeviceRecovery(): boolean {
    return true;
  }

  public hasNativeShapeShift(): boolean {
    // It doesn't... yet?
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
