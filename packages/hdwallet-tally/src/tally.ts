import * as core from "@shapeshiftoss/hdwallet-core";
import _ from "lodash";

import * as eth from "./ethereum";

export function isTally(wallet: core.HDWallet): wallet is TallyHDWallet {
  return _.isObject(wallet) && (wallet as any)._isTally;
}

export class TallyHDWalletInfo implements core.HDWalletInfo, core.ETHWalletInfo {
  readonly _supportsETHInfo = true;

  public getVendor(): string {
    return "Tally";
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
        return eth.describeETHPath(msg.path);
      default:
        throw new Error("Unsupported path");
    }
  }

  public ethNextAccountPath(msg: core.ETHAccountPath): core.ETHAccountPath | undefined {
    //eslint-disable-line no-unused-vars
    // TODO: What do we do here?
    msg; // still raises defined but never used
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
    return true;
  }

  public ethGetAccountPaths(msg: core.ETHGetAccountPath): Array<core.ETHAccountPath> {
    return eth.ethGetAccountPaths(msg);
  }
}

export class TallyHDWallet implements core.HDWallet, core.ETHWallet {
  readonly _supportsETH = true;
  readonly _supportsETHInfo = true;
  readonly _isTally = true;

  info: TallyHDWalletInfo & core.HDWalletInfo;
  ethAddress?: string | null;
  provider: any;

  constructor(provider: unknown) {
    this.info = new TallyHDWalletInfo();
    this.provider = provider;
  }

  async getFeatures(): Promise<Record<string, any>> {
    return {};
  }

  public async isLocked(): Promise<boolean> {
    return !this.provider.tally.isUnlocked();
  }

  public getVendor(): string {
    return "Tally";
  }

  public async getModel(): Promise<string> {
    return "Tally";
  }

  public async getLabel(): Promise<string> {
    return "Tally";
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
    // Keep an eye on the status of the refactor PR here: https://github.com/tallycash/extension/pull/1165/files. This will add offline signing support to Tally, at which point this should return true.
    return false;
  }

  public supportsBroadcast(): boolean {
    return true;
  }

  public async clearSession(): Promise<void> {
    // TODO: Can we lock Tally from here?
  }

  public async ping(msg: core.Ping): Promise<core.Pong> {
    // no ping function for Tally, so just returning Core.Pong
    return { msg: msg.msg };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async sendPin(pin: string): Promise<void> {
    // no concept of pin in Tally
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async sendPassphrase(passphrase: string): Promise<void> {
    // cannot send passphrase to Tally. Could show the widget?
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async sendCharacter(charater: string): Promise<void> {
    // no concept of sendCharacter in Tally
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async sendWord(word: string): Promise<void> {
    // no concept of sendWord in Tally
  }

  public async cancel(): Promise<void> {
    // no concept of cancel in Tally
  }
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  public async wipe(): Promise<void> {}

  // eslint-disable-next-line @typescript-eslint/no-empty-function, @typescript-eslint/no-unused-vars
  public async reset(msg: core.ResetDevice): Promise<void> {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async recover(msg: core.RecoverDevice): Promise<void> {
    // no concept of recover in Tally
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async loadDevice(msg: core.LoadDevice): Promise<void> {
    // TODO: Does Tally allow this to be done programatically?
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
    return true;
  }

  public ethGetAccountPaths(msg: core.ETHGetAccountPath): Array<core.ETHAccountPath> {
    return eth.ethGetAccountPaths(msg);
  }

  public ethNextAccountPath(msg: core.ETHAccountPath): core.ETHAccountPath | undefined {
    return this.info.ethNextAccountPath(msg);
  }

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
    return "tally:" + (await this.ethGetAddress(this.provider));
  }

  public async getFirmwareVersion(): Promise<string> {
    return "tally";
  }
}