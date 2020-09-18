import { isObject, get } from "lodash";
import * as core from "@shapeshiftoss/hdwallet-core";
import * as btc from "./bitcoin";
import * as eth from "./ethereum";
import { LedgerTransport } from "./transport";
import { networksUtil, handleError } from "./utils";

export function isLedger(wallet: core.HDWallet): wallet is LedgerHDWallet {
  return isObject(wallet) && (wallet as any)._isLedger;
}

export class LedgerHDWalletInfo implements core.HDWalletInfo, core.BTCWalletInfo, core.ETHWalletInfo {
  _supportsBTCInfo: boolean = true;
  _supportsETHInfo: boolean = true;
  _supportsCosmosInfo: boolean = false; // TODO ledger supports cosmos
  _supportsBinanceInfo: boolean = false; // TODO ledger supports bnb
  _supportsRippleInfo: boolean = false; // TODO ledger supports XRP
  _supportsEosInfo: boolean = false;

  public getVendor(): string {
    return "Ledger";
  }

  public async btcSupportsCoin(coin: core.Coin): Promise<boolean> {
    return btc.btcSupportsCoin(coin);
  }

  public async btcSupportsScriptType(coin: core.Coin, scriptType: core.BTCInputScriptType): Promise<boolean> {
    return btc.btcSupportsScriptType(coin, scriptType);
  }

  public async btcSupportsSecureTransfer(): Promise<boolean> {
    return btc.btcSupportsSecureTransfer();
  }

  public btcSupportsNativeShapeShift(): boolean {
    return btc.btcSupportsNativeShapeShift();
  }

  public btcGetAccountPaths(msg: core.BTCGetAccountPaths): Array<core.BTCAccountPath> {
    return btc.btcGetAccountPaths(msg);
  }

  public btcIsSameAccount(msg: Array<core.BTCAccountPath>): boolean {
    return btc.btcIsSameAccount(msg);
  }

  public async ethSupportsNetwork(chain_id: number): Promise<boolean> {
    return eth.ethSupportsNetwork(chain_id);
  }

  public async ethSupportsSecureTransfer(): Promise<boolean> {
    return eth.ethSupportsSecureTransfer();
  }

  public ethSupportsNativeShapeShift(): boolean {
    return eth.ethSupportsNativeShapeShift();
  }

  public ethGetAccountPaths(msg: core.ETHGetAccountPath): Array<core.ETHAccountPath> {
    return eth.ethGetAccountPaths(msg);
  }

  public hasNativeShapeShift(srcCoin: core.Coin, dstCoin: core.Coin): boolean {
    return false;
  }

  public hasOnDeviceDisplay(): boolean {
    return true;
  }

  public hasOnDevicePassphrase(): boolean {
    return true;
  }

  public hasOnDevicePinEntry(): boolean {
    return true;
  }

  public hasOnDeviceRecovery(): boolean {
    return true;
  }

  public describePath(msg: core.DescribePath): core.PathDescription {
    switch (msg.coin) {
      case "Ethereum":
        return core.ethDescribePath(msg.path);
      default:
        return core.btcDescribePath(msg.path, msg.coin, msg.scriptType);
    }
  }

  public btcNextAccountPath(msg: core.BTCAccountPath): core.BTCAccountPath | undefined {
    return core.btcNextAccountPath(msg);
  }

  public ethNextAccountPath(msg: core.ETHAccountPath): core.ETHAccountPath | undefined {
    return core.ethNextAccountPath(msg);
  }
}

export class LedgerHDWallet implements core.HDWallet, core.BTCWallet, core.ETHWallet {
  _supportsETHInfo: boolean = true;
  _supportsBTCInfo: boolean = true;
  _supportsDebugLink: boolean = false;
  _supportsBTC: boolean = true;
  _supportsETH: boolean = true;
  _supportsBinanceInfo: boolean = false;
  _supportsBinance: boolean = false;
  _supportsRippleInfo: boolean = false;
  _supportsRipple: boolean = false;
  _supportsCosmosInfo: boolean = false;
  _supportsCosmos: boolean = false;
  _supportsEosInfo: boolean = false;
  _supportsEos: boolean = false;

  _isLedger: boolean = true;

  transport: LedgerTransport;
  info: LedgerHDWalletInfo & core.HDWalletInfo;

  constructor(transport: LedgerTransport) {
    this.transport = transport;
    this.info = new LedgerHDWalletInfo();
  }

  public async initialize(): Promise<any> {
    return;
  }

  public async isInitialized(): Promise<boolean> {
    // AFAICT, there isn't an API to figure this out, so we go with a reasonable
    // (ish) default:
    return true;
  }

  public async getDeviceID(): Promise<string> {
    const {
      device: { serialNumber: deviceID },
    } = this.transport as any;
    return deviceID;
  }

  public async getFeatures(): Promise<any> {
    const res = await this.transport.call(null, "getDeviceInfo");
    handleError(res, this.transport);
    return res.payload;
  }

  /**
   * Validate if a specific app is open
   * Throws WrongApp error if app associated with coin is not open
   * @param coin  Name of coin for app name lookup
   */
  public async validateCurrentApp(coin: core.Coin): Promise<void> {
    if (!coin) {
      throw new Error(`No coin provided`);
    }

    const appName = get(networksUtil[core.slip44ByCoin(coin)], "appName");
    if (!appName) {
      throw new Error(`Unable to find associated app name for coin: ${coin}`);
    }

    const res = await this.transport.call(null, "getAppAndVersion");
    handleError(res, this.transport);

    const {
      payload: { name: currentApp },
    } = res;
    if (currentApp !== appName) {
      throw new core.WrongApp("Ledger", appName);
    }
  }

  /**
   * Prompt user to open given app on device
   * User must be in dashboard
   * @param appName - human-readable app name i.e. "Bitcoin Cash"
   */
  public async openApp(appName: string): Promise<void> {
    const res = await this.transport.call(null, "openApp", appName);
    handleError(res, this.transport);
  }

  public async getFirmwareVersion(): Promise<string> {
    const { version } = await this.getFeatures();
    return version;
  }

  public getVendor(): string {
    return "Ledger";
  }

  public async getModel(): Promise<string> {
    const {
      device: { productName },
    } = this.transport as any;
    return productName;
  }

  public async getLabel(): Promise<string> {
    return "Ledger";
  }

  public async isLocked(): Promise<boolean> {
    return true;
  }

  public async clearSession(): Promise<void> {
    return;
  }

  public async getPublicKeys(msg: Array<core.GetPublicKey>): Promise<Array<core.PublicKey | null>> {
    const res = await this.transport.call(null, "getAppAndVersion");
    handleError(res, this.transport);

    const {
      payload: { name },
    } = res;

    switch (name) {
      case "Bitcoin":
        return btc.btcGetPublicKeys(this.transport, msg);
      case "Ethereum":
        return eth.ethGetPublicKeys(this.transport, msg);
      default:
        throw new Error(`getPublicKeys is not supported with the ${name} app`);
    }
  }

  public hasNativeShapeShift(srcCoin: core.Coin, dstCoin: core.Coin): boolean {
    return false;
  }

  public hasOnDeviceDisplay(): boolean {
    return true;
  }

  public hasOnDevicePassphrase(): boolean {
    return true;
  }

  public hasOnDevicePinEntry(): boolean {
    return true;
  }

  public hasOnDeviceRecovery(): boolean {
    return true;
  }

  public async loadDevice(msg: core.LoadDevice): Promise<void> {
    return;
  }

  // Ledger doesn't have this, faking response here
  public async ping(msg: core.Ping): Promise<core.Pong> {
    return { msg: msg.msg };
  }

  public async cancel(): Promise<void> {
    return;
  }

  public async recover(msg: core.RecoverDevice): Promise<void> {
    return;
  }

  public async reset(msg: core.ResetDevice): Promise<void> {
    return;
  }

  public async sendCharacter(character: string): Promise<void> {
    return;
  }

  public async sendPassphrase(passphrase: string): Promise<void> {
    return;
  }

  public async sendPin(pin: string): Promise<void> {
    return;
  }

  public async sendWord(word: string): Promise<void> {
    return;
  }

  public async wipe(): Promise<void> {
    return;
  }

  public async btcSupportsCoin(coin: core.Coin): Promise<boolean> {
    return this.info.btcSupportsCoin(coin);
  }

  public async btcSupportsScriptType(coin: core.Coin, scriptType: core.BTCInputScriptType): Promise<boolean> {
    return this.info.btcSupportsScriptType(coin, scriptType);
  }

  public async btcGetAddress(msg: core.BTCGetAddress): Promise<string> {
    await this.validateCurrentApp(msg.coin);
    return btc.btcGetAddress(this.transport, msg);
  }

  public async btcSignTx(msg: core.BTCSignTx): Promise<core.BTCSignedTx> {
    await this.validateCurrentApp(msg.coin);
    return btc.btcSignTx(this, this.transport, msg);
  }

  public async btcSupportsSecureTransfer(): Promise<boolean> {
    return this.info.btcSupportsSecureTransfer();
  }

  public btcSupportsNativeShapeShift(): boolean {
    return this.info.btcSupportsNativeShapeShift();
  }

  public async btcSignMessage(msg: core.BTCSignMessage): Promise<core.BTCSignedMessage> {
    await this.validateCurrentApp(msg.coin);
    return btc.btcSignMessage(this, this.transport, msg);
  }

  public async btcVerifyMessage(msg: core.BTCVerifyMessage): Promise<boolean> {
    return btc.btcVerifyMessage(msg);
  }

  public btcGetAccountPaths(msg: core.BTCGetAccountPaths): Array<core.BTCAccountPath> {
    return this.info.btcGetAccountPaths(msg);
  }

  public btcIsSameAccount(msg: Array<core.BTCAccountPath>): boolean {
    return this.info.btcIsSameAccount(msg);
  }

  public async ethSignTx(msg: core.ETHSignTx): Promise<core.ETHSignedTx> {
    await this.validateCurrentApp("Ethereum");
    return eth.ethSignTx(this.transport, msg);
  }

  public async ethGetAddress(msg: core.ETHGetAddress): Promise<string> {
    await this.validateCurrentApp("Ethereum");
    return eth.ethGetAddress(this.transport, msg);
  }

  public async ethSignMessage(msg: core.ETHSignMessage): Promise<core.ETHSignedMessage> {
    await this.validateCurrentApp("Ethereum");
    return eth.ethSignMessage(this.transport, msg);
  }

  public async ethVerifyMessage(msg: core.ETHVerifyMessage): Promise<boolean> {
    return eth.ethVerifyMessage(msg);
  }

  public async ethSupportsNetwork(chain_id: number): Promise<boolean> {
    return this.info.ethSupportsNetwork(chain_id);
  }

  public async ethSupportsSecureTransfer(): Promise<boolean> {
    return this.info.ethSupportsSecureTransfer();
  }

  public ethSupportsNativeShapeShift(): boolean {
    return this.info.ethSupportsNativeShapeShift();
  }

  public ethGetAccountPaths(msg: core.ETHGetAccountPath): Array<core.ETHAccountPath> {
    return this.info.ethGetAccountPaths(msg);
  }

  public describePath(msg: core.DescribePath): core.PathDescription {
    return this.info.describePath(msg);
  }

  public disconnect(): Promise<void> {
    return this.transport.disconnect();
  }

  public btcNextAccountPath(msg: core.BTCAccountPath): core.BTCAccountPath | undefined {
    return this.info.btcNextAccountPath(msg);
  }

  public ethNextAccountPath(msg: core.ETHAccountPath): core.ETHAccountPath | undefined {
    return this.info.ethNextAccountPath(msg);
  }
}

export function info(): LedgerHDWalletInfo {
  return new LedgerHDWalletInfo();
}

export function create(transport: LedgerTransport): LedgerHDWallet {
  return new LedgerHDWallet(transport);
}
