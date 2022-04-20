import Portis from "@portis/web3";
import * as core from "@shapeshiftoss/hdwallet-core";
import _ from "lodash";
import PLazy from "p-lazy";
import type Web3 from "web3";

import * as btc from "./bitcoin";
import * as eth from "./ethereum";

const web3 = PLazy.from(async () => (await import("web3")).default);

export function isPortis(wallet: core.HDWallet): wallet is PortisHDWallet {
  return _.isObject(wallet) && (wallet as any)._isPortis;
}

type HasNonTrivialConstructor<T> = T extends { new (): any } ? never : T;
export type Portis = InstanceType<HasNonTrivialConstructor<typeof Portis>>;

export class PortisHDWalletInfo implements core.HDWalletInfo, core.ETHWalletInfo, core.BTCWalletInfo {
  readonly _supportsBTCInfo = true;
  readonly _supportsETHInfo = true;

  public getVendor(): string {
    return "Portis";
  }

  public hasOnDevicePinEntry(): boolean {
    return true;
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
    return true;
  }

  public supportsBroadcast(): boolean {
    return false;
  }

  public describePath(msg: core.DescribePath): core.PathDescription {
    switch (msg.coin) {
      case "Ethereum":
        return eth.describeETHPath(msg.path);
      case "Bitcoin":
        return btc.describeUTXOPath(msg.path, msg.coin, msg.scriptType);
      default:
        throw new Error("Unsupported path");
    }
  }

  public async btcSupportsCoin(coin: core.Coin): Promise<boolean> {
    return btc.btcSupportsCoin(coin);
  }

  public async btcSupportsScriptType(coin: core.Coin, scriptType: core.BTCInputScriptType): Promise<boolean> {
    return btc.btcSupportsScriptType(coin, scriptType);
  }

  public async btcSupportsSecureTransfer(): Promise<boolean> {
    return false;
  }

  public btcSupportsNativeShapeShift(): boolean {
    return false;
  }

  public btcGetAccountPaths(msg: core.BTCGetAccountPaths): Array<core.BTCAccountPath> {
    return btc.btcGetAccountPaths(msg);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public btcIsSameAccount(msg: Array<core.BTCAccountPath>): boolean {
    // TODO: Probably not correct
    return false;
  }

  public btcNextAccountPath(msg: core.BTCAccountPath): core.BTCAccountPath | undefined {
    return btc.btcNextAccountPath(msg);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public ethNextAccountPath(msg: core.ETHAccountPath): core.ETHAccountPath | undefined {
    // Portis only supports one account for eth
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

export class PortisHDWallet implements core.HDWallet, core.ETHWallet, core.BTCWallet {
  readonly _supportsETH = true;
  readonly _supportsETHInfo = true;
  readonly _supportsBTCInfo = true;
  readonly _supportsBTC = true;
  readonly _isPortis = true;

  portis: Portis;
  web3: Promise<Web3>;
  info: PortisHDWalletInfo & core.HDWalletInfo;
  ethAddress?: string;

  // used as a mutex to ensure calls to portis.getExtendedPublicKey cannot happen before a previous call has resolved
  protected portisCallInProgress: Promise<void> = Promise.resolve();

  constructor(portis: Portis) {
    this.portis = portis;
    this.web3 = (async () => {
      return new (await web3)(portis.provider);
    })();
    this.info = new PortisHDWalletInfo();
  }

  async getFeatures(): Promise<Record<string, any>> {
    return {};
  }

  public async isLocked(): Promise<boolean> {
    return false;
  }

  public getVendor(): string {
    return "Portis";
  }

  public async getModel(): Promise<string> {
    return "portis";
  }

  public async getLabel(): Promise<string> {
    return "Portis";
  }

  public async initialize(): Promise<void> {
    // no means to reset the state of the Portis widget
    // while it's in the middle of execution
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
    return true;
  }

  public supportsBroadcast(): boolean {
    return false;
  }

  public async clearSession(): Promise<void> {
    await this.portis.logout();
  }

  public async ping(msg: core.Ping): Promise<core.Pong> {
    // no ping function for Portis, so just returning Core.Pong
    return { msg: msg.msg };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async sendPin(pin: string): Promise<void> {
    // no concept of pin in Portis
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async sendPassphrase(passphrase: string): Promise<void> {
    // cannot send passphrase to Portis. Could show the widget?
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async sendCharacter(charater: string): Promise<void> {
    // no concept of sendCharacter in Portis
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async sendWord(word: string): Promise<void> {
    // no concept of sendWord in Portis
  }

  public async cancel(): Promise<void> {
    // no concept of cancel in Portis
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  public async wipe(): Promise<void> {}

  // eslint-disable-next-line @typescript-eslint/no-empty-function, @typescript-eslint/no-unused-vars
  public async reset(msg: core.ResetDevice): Promise<void> {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async recover(msg: core.RecoverDevice): Promise<void> {
    // no concept of recover in Portis
  }

  public loadDevice(msg: core.LoadDevice): Promise<void> {
    return this.portis.importWallet(msg.mnemonic);
  }

  public describePath(msg: core.DescribePath): core.PathDescription {
    return this.info.describePath(msg);
  }

  public async getPublicKeys(msg: Array<core.GetPublicKey>): Promise<Array<core.PublicKey | null>> {
    const publicKeys: { xpub: string }[] = [];
    const out = this.portisCallInProgress.then(async () => {
      for (let i = 0; i < msg.length; i++) {
        const { addressNList } = msg[i];
        const bitcoinSlip44 = 0x80000000 + core.slip44ByCoin("Bitcoin");
        // TODO we really shouldnt be every using the "bitcoin" string parameter but is here for now to make it work with their btc address on their portis wallet.
        const portisResult: { error: string; result: string } = await this.portis.getExtendedPublicKey(
          core.addressNListToBIP32(addressNList),
          addressNList[1] === bitcoinSlip44 ? "Bitcoin" : ""
        );
        const { result, error } = portisResult;
        if (error) throw error;
        publicKeys.push({ xpub: result });
      }
      return publicKeys;
    });
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    this.portisCallInProgress = out.then(() => {});
    return out;
  }

  public async isInitialized(): Promise<boolean> {
    return true;
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  public async disconnect(): Promise<void> {}

  public async btcGetAddress(msg: core.BTCGetAddress): Promise<string> {
    return btc.btcGetAddress(msg, this.portis);
  }

  public async btcSignTx(msg: core.BTCSignTx): Promise<core.BTCSignedTx> {
    return btc.btcSignTx(msg, this.portis);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async btcSignMessage(msg: core.BTCSignMessage): Promise<core.BTCSignedMessage> {
    // portis doesnt support this for btc
    throw new Error("not supported");
  }

  public async btcVerifyMessage(msg: core.BTCVerifyMessage): Promise<boolean> {
    return btc.btcVerifyMessage(msg);
  }

  public async btcSupportsCoin(coin: core.Coin): Promise<boolean> {
    return this.info.btcSupportsCoin(coin);
  }

  public async btcSupportsScriptType(coin: core.Coin, scriptType: core.BTCInputScriptType): Promise<boolean> {
    return this.info.btcSupportsScriptType(coin, scriptType);
  }

  public async btcSupportsSecureTransfer(): Promise<boolean> {
    return this.info.btcSupportsSecureTransfer();
  }

  public btcSupportsNativeShapeShift(): boolean {
    return this.info.btcSupportsNativeShapeShift();
  }

  public btcGetAccountPaths(msg: core.BTCGetAccountPaths): Array<core.BTCAccountPath> {
    return this.info.btcGetAccountPaths(msg);
  }

  public btcIsSameAccount(msg: Array<core.BTCAccountPath>): boolean {
    return this.info.btcIsSameAccount(msg);
  }

  public btcNextAccountPath(msg: core.BTCAccountPath): core.BTCAccountPath | undefined {
    return this.info.btcNextAccountPath(msg);
  }

  public async ethSupportsNetwork(chainId = 1): Promise<boolean> {
    return this.info.ethSupportsNetwork(chainId);
  }

  public async ethSupportsSecureTransfer(): Promise<boolean> {
    return this.info.ethSupportsSecureTransfer();
  }

  public ethSupportsNativeShapeShift(): boolean {
    return this.info.ethSupportsNativeShapeShift();
  }

  public async ethSupportsEIP1559(): Promise<boolean> {
    return await this.info.ethSupportsEIP1559();
  }

  public async ethVerifyMessage(msg: core.ETHVerifyMessage): Promise<boolean> {
    return eth.ethVerifyMessage(msg, await this.web3);
  }

  public ethNextAccountPath(msg: core.ETHAccountPath): core.ETHAccountPath | undefined {
    // Portis only supports one account for eth
    return this.info.ethNextAccountPath(msg);
  }

  public async ethSignTx(msg: core.ETHSignTx): Promise<core.ETHSignedTx> {
    return eth.ethSignTx(msg, await this.web3, await this._ethGetAddress());
  }

  public async ethSignMessage(msg: core.ETHSignMessage): Promise<core.ETHSignedMessage> {
    return eth.ethSignMessage(msg, await this.web3, await this._ethGetAddress());
  }

  public ethGetAccountPaths(msg: core.ETHGetAccountPath): Array<core.ETHAccountPath> {
    return this.info.ethGetAccountPaths(msg);
  }

  public async ethGetAddress(msg: core.ETHGetAddress): Promise<string> {
    if (msg.showDisplay === true) {
      this.portis.showPortis();
    }
    return this._ethGetAddress();
  }

  public async getDeviceID(): Promise<string> {
    return "portis:" + (await this._ethGetAddress());
  }

  public async getFirmwareVersion(): Promise<string> {
    return "portis";
  }

  public async _ethGetAddress(): Promise<string> {
    if (this.ethAddress) return this.ethAddress;

    const out: string = (await (await this.web3).eth.getAccounts())[0];
    this.ethAddress = out;
    return out;
  }
}

export function info() {
  return new PortisHDWalletInfo();
}

export function create(portis: Portis): PortisHDWallet {
  return new PortisHDWallet(portis);
}
