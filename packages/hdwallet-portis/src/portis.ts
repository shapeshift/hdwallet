import Portis from "@portis/web3";
import * as core from "@shapeshiftoss/hdwallet-core";
import _ from "lodash";
import Web3 from "web3";

import * as btc from "./bitcoin";
import * as eth from "./ethereum";

// We might not need this. Leaving it for now to debug further
class PortisTransport extends core.Transport {
  public async getDeviceID() {
    return "portis:0";
  }

  public call(...args: any[]): Promise<any> {
    return Promise.resolve();
  }
}

export function isPortis(wallet: core.HDWallet): wallet is PortisHDWallet {
  return _.isObject(wallet) && (wallet as any)._isPortis;
}

type HasNonTrivialConstructor<T> = T extends { new (): any } ? never : T;
export type Portis = InstanceType<HasNonTrivialConstructor<typeof Portis>>;

export class PortisHDWallet implements core.HDWallet, core.ETHWallet, core.BTCWallet {
  readonly _supportsETH = true;
  readonly _supportsETHInfo = true;
  readonly _supportsBTCInfo = true;
  readonly _supportsBTC = true;
  readonly _supportsCosmosInfo = false;
  readonly _supportsCosmos = false;
  readonly _supportsOsmosisInfo = false;
  readonly _supportsOsmosis = false;
  readonly _supportsBinanceInfo = false;
  readonly _supportsBinance = false;
  readonly _supportsDebugLink = false;
  readonly _isPortis = true;
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

  transport: core.Transport = new PortisTransport(new core.Keyring());

  portis: Portis;
  web3: any;
  info: PortisHDWalletInfo & core.HDWalletInfo;
  ethAddress?: string;

  // used as a mutex to ensure calls to portis.getExtendedPublicKey cannot happen before a previous call has resolved
  portisCallInProgress: Promise<any> = Promise.resolve();

  constructor(portis: Portis) {
    this.portis = portis;
    this.web3 = new Web3(portis.provider);
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

  public getModel(): Promise<string> {
    return Promise.resolve("portis");
  }

  public getLabel(): Promise<string> {
    return Promise.resolve("Portis");
  }

  public initialize(): Promise<any> {
    // no means to reset the state of the Portis widget
    // while it's in the middle of execution
    return Promise.resolve();
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

  public async clearSession(): Promise<void> {
    await this.portis.logout();
  }

  public ping(msg: core.Ping): Promise<core.Pong> {
    // no ping function for Portis, so just returning Core.Pong
    return Promise.resolve({ msg: msg.msg });
  }

  public sendPin(pin: string): Promise<void> {
    // no concept of pin in Portis
    return Promise.resolve();
  }

  public sendPassphrase(passphrase: string): Promise<void> {
    // cannot send passphrase to Portis. Could show the widget?
    return Promise.resolve();
  }

  public sendCharacter(charater: string): Promise<void> {
    // no concept of sendCharacter in Portis
    return Promise.resolve();
  }

  public sendWord(word: string): Promise<void> {
    // no concept of sendWord in Portis
    return Promise.resolve();
  }

  public cancel(): Promise<void> {
    // no concept of cancel in Portis
    return Promise.resolve();
  }

  public wipe(): Promise<void> {
    return Promise.resolve();
  }

  public reset(msg: core.ResetDevice): Promise<void> {
    return Promise.resolve();
  }

  public recover(msg: core.RecoverDevice): Promise<void> {
    // no concept of recover in Portis
    return Promise.resolve();
  }

  public loadDevice(msg: core.LoadDevice): Promise<void> {
    return this.portis.importWallet(msg.mnemonic);
  }

  public describePath(msg: core.DescribePath): core.PathDescription {
    return this.info.describePath(msg);
  }

  public async getPublicKeys(msg: Array<core.GetPublicKey>): Promise<Array<core.PublicKey | null>> {
    const publicKeys: { xpub: string }[] = [];
    this.portisCallInProgress = new Promise(async (resolve, reject) => {
      try {
        await this.portisCallInProgress;
      } catch (e) {
        console.error(e);
      }
      for (let i = 0; i < msg.length; i++) {
        const { addressNList, coin } = msg[i];
        const bitcoinSlip44 = 0x80000000 + core.slip44ByCoin("Bitcoin");
        // TODO we really shouldnt be every using the "bitcoin" string parameter but is here for now to make it work with their btc address on their portis wallet.
        const portisResult: { error: string; result: string } = await this.portis.getExtendedPublicKey(
          core.addressNListToBIP32(addressNList),
          addressNList[1] === bitcoinSlip44 ? "Bitcoin" : ""
        );
        const { result, error } = portisResult;
        if (error) reject(error);
        publicKeys.push({ xpub: result });
      }
      resolve(publicKeys);
    });
    return this.portisCallInProgress;
  }

  public async isInitialized(): Promise<boolean> {
    return true;
  }

  public disconnect(): Promise<void> {
    return Promise.resolve();
  }

  public async btcGetAddress(msg: core.BTCGetAddress): Promise<string> {
    return btc.btcGetAddress(msg, this.portis);
  }

  public async btcSignTx(msg: core.BTCSignTx): Promise<core.BTCSignedTx> {
    return btc.btcSignTx(msg, this.portis);
  }

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

  public async ethSupportsNetwork(chainId: number = 1): Promise<boolean> {
    return this.info.ethSupportsNetwork(chainId);
  }

  public async ethSupportsSecureTransfer(): Promise<boolean> {
    return this.info.ethSupportsSecureTransfer();
  }

  public ethSupportsNativeShapeShift(): boolean {
    return this.info.ethSupportsNativeShapeShift();
  }

  public async ethVerifyMessage(msg: core.ETHVerifyMessage): Promise<boolean> {
    return eth.ethVerifyMessage(msg, this.web3);
  }

  public ethNextAccountPath(msg: core.ETHAccountPath): core.ETHAccountPath | undefined {
    // Portis only supports one account for eth
    return this.info.ethNextAccountPath(msg);
  }

  public async ethSignTx(msg: core.ETHSignTx): Promise<core.ETHSignedTx> {
    return eth.ethSignTx(msg, this.web3, await this._ethGetAddress());
  }

  public async ethSignMessage(msg: core.ETHSignMessage): Promise<core.ETHSignedMessage> {
    return eth.ethSignMessage(msg, this.web3, await this._ethGetAddress());
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

    const out: string = (await this.web3.eth.getAccounts())[0];
    this.ethAddress = out;
    return out;
  }
}

export class PortisHDWalletInfo implements core.HDWalletInfo, core.ETHWalletInfo, core.BTCWalletInfo {
  readonly _supportsBTCInfo = true;
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

  public hasNativeShapeShift(srcCoin: core.Coin, dstCoin: core.Coin): boolean {
    // It doesn't... yet?
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
    return Promise.resolve(false);
  }

  public btcSupportsNativeShapeShift(): boolean {
    return false;
  }

  public btcGetAccountPaths(msg: core.BTCGetAccountPaths): Array<core.BTCAccountPath> {
    return btc.btcGetAccountPaths(msg);
  }

  public btcIsSameAccount(msg: Array<core.BTCAccountPath>): boolean {
    return false;
  }

  public btcNextAccountPath(msg: core.BTCAccountPath): core.BTCAccountPath | undefined {
    return btc.btcNextAccountPath(msg);
  }

  public ethNextAccountPath(msg: core.ETHAccountPath): core.ETHAccountPath | undefined {
    // Portis only supports one account for eth
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

  public ethGetAccountPaths(msg: core.ETHGetAccountPath): Array<core.ETHAccountPath> {
    return eth.ethGetAccountPaths(msg);
  }
}

export function info() {
  return new PortisHDWalletInfo();
}

export function create(portis: Portis): PortisHDWallet {
  return new PortisHDWallet(portis);
}
