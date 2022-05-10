import * as core from "@shapeshiftoss/hdwallet-core";
import _ from "lodash";

import * as eth from "./ethereum";

export function isMetaMask(wallet: core.HDWallet): wallet is MetaMaskHDWallet {
  return _.isObject(wallet) && (wallet as any)._isMetaMask;
}

export class MetaMaskHDWalletInfo implements core.HDWalletInfo, core.ETHWalletInfo {
  readonly _supportsBTCInfo = false;
  readonly _supportsETHInfo = true;
  readonly _supportsCosmosInfo = false;
  readonly _supportsBinanceInfo = false;
  readonly _supportsRippleInfo = false;
  readonly _supportsEosInfo = false;
  readonly _supportsFioInfo = false;
  readonly _supportsThorchainInfo = false;
  readonly _supportsSecretInfo = false;
  readonly _supportsKavaInfo = false;
  readonly _supportsTerraInfo = false;

  public getVendor(): string {
    return "MetaMask";
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public hasNativeShapeShift(srcCoin: core.Coin, dstCoin: core.Coin): boolean {
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
        return eth.describeETHPath(msg.path);
      default:
        throw new Error("Unsupported path");
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public ethNextAccountPath(msg: core.ETHAccountPath): core.ETHAccountPath | undefined {
    // TODO: What do we do here?
    return undefined;
  }

  public async ethSupportsNetwork(chainId = 1): Promise<boolean> {
    return chainId === 1;
  }

  public async ethSupportsSecureTransfer(): Promise<boolean> {
    return false;
  }

  public ethSupportsNativeShapeShift(): boolean {
    return false;
  }

  public async ethSupportsEIP1559(): Promise<boolean> {
    return false;
  }

  public ethGetAccountPaths(msg: core.ETHGetAccountPath): Array<core.ETHAccountPath> {
    return eth.ethGetAccountPaths(msg);
  }
}

export class MetaMaskHDWallet implements core.HDWallet, core.ETHWallet {
  readonly _supportsETH = true;
  readonly _supportsETHInfo = true;
  readonly _supportsBTCInfo = false;
  readonly _supportsBTC = false;
  readonly _supportsCosmosInfo = false;
  readonly _supportsCosmos = false;
  readonly _supportsOsmosisInfo = false;
  readonly _supportsOsmosis = false;
  readonly _supportsBinanceInfo = false;
  readonly _supportsBinance = false;
  readonly _supportsDebugLink = false;
  readonly _isPortis = false;
  readonly _isMetaMask = true;
  readonly _supportsRippleInfo = false;
  readonly _supportsRipple = false;
  readonly _supportsEosInfo = false;
  readonly _supportsEos = false;
  readonly _supportsFioInfo = false;
  readonly _supportsFio = false;
  readonly _supportsThorchainInfo = false;
  readonly _supportsThorchain = false;
  readonly _supportsSecretInfo = false;
  readonly _supportsSecret = false;
  readonly _supportsKava = false;
  readonly _supportsKavaInfo = false;
  readonly _supportsTerra = false;
  readonly _supportsTerraInfo = false;

  info: MetaMaskHDWalletInfo & core.HDWalletInfo;
  ethAddress?: string | null;
  provider: any;

  constructor(provider: unknown) {
    this.info = new MetaMaskHDWalletInfo();
    this.provider = provider;
  }

  async getFeatures(): Promise<Record<string, any>> {
    return {};
  }

  public async isLocked(): Promise<boolean> {
    return !this.provider._metamask.isUnlocked();
  }

  public getVendor(): string {
    return "MetaMask";
  }

  public async getModel(): Promise<string> {
    return "MetaMask";
  }

  public async getLabel(): Promise<string> {
    return "MetaMask";
  }

  public async initialize(): Promise<void> {
    // nothing to initialize
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
    // TODO: Can we lock MetaMask from here?
  }

  public async ping(msg: core.Ping): Promise<core.Pong> {
    // no ping function for MetaMask, so just returning Core.Pong
    return { msg: msg.msg };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async sendPin(pin: string): Promise<void> {
    // no concept of pin in MetaMask
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async sendPassphrase(passphrase: string): Promise<void> {
    // cannot send passphrase to MetaMask. Could show the widget?
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async sendCharacter(charater: string): Promise<void> {
    // no concept of sendCharacter in MetaMask
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async sendWord(word: string): Promise<void> {
    // no concept of sendWord in MetaMask
  }

  public async cancel(): Promise<void> {
    // no concept of cancel in MetaMask
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  public async wipe(): Promise<void> {}

  // eslint-disable-next-line @typescript-eslint/no-empty-function, @typescript-eslint/no-unused-vars
  public async reset(msg: core.ResetDevice): Promise<void> {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async recover(msg: core.RecoverDevice): Promise<void> {
    // no concept of recover in MetaMask
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async loadDevice(msg: core.LoadDevice): Promise<void> {
    // TODO: Does MetaMask allow this to be done programatically?
  }

  public describePath(msg: core.DescribePath): core.PathDescription {
    return this.info.describePath(msg);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async getPublicKeys(msg: Array<core.GetPublicKey>): Promise<Array<core.PublicKey | null>> {
    // Ethereum public keys are not exposed by the RPC API
    return [];
  }

  public async isInitialized(): Promise<boolean> {
    return true;
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  public async disconnect(): Promise<void> {}

  public async ethSupportsNetwork(chainId = 1): Promise<boolean> {
    return chainId === 1;
  }

  public async ethSupportsSecureTransfer(): Promise<boolean> {
    return false;
  }

  public ethSupportsNativeShapeShift(): boolean {
    return false;
  }

  public async ethSupportsEIP1559(): Promise<boolean> {
    return false;
  }

  public ethGetAccountPaths(msg: core.ETHGetAccountPath): Array<core.ETHAccountPath> {
    return eth.ethGetAccountPaths(msg);
  }

  public ethNextAccountPath(msg: core.ETHAccountPath): core.ETHAccountPath | undefined {
    return this.info.ethNextAccountPath(msg);
  }

  // TODO: Respect msg.addressNList!
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async ethGetAddress(msg: core.ETHGetAddress): Promise<string | null> {
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
    const address = await this.ethGetAddress(this.provider);
    return address ? eth.ethSignTx(msg, this.provider, address) : null;
  }

  public async ethSendTx(msg: core.ETHSignTx): Promise<core.ETHTxHash | null> {
    const address = await this.ethGetAddress(this.provider);
    return address ? eth.ethSendTx(msg, this.provider, address) : null;
  }

  public async ethSignMessage(msg: core.ETHSignMessage): Promise<core.ETHSignedMessage | null> {
    const address = await this.ethGetAddress(this.provider);
    return address ? eth.ethSignMessage(msg, this.provider, address) : null;
  }

  public async ethVerifyMessage(msg: core.ETHVerifyMessage): Promise<boolean | null> {
    return eth.ethVerifyMessage(msg, this.provider);
  }

  public async getDeviceID(): Promise<string> {
    return "metaMask:" + (await this.ethGetAddress(this.provider));
  }

  public async getFirmwareVersion(): Promise<string> {
    return "metaMask";
  }
}
