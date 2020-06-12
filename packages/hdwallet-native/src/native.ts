import * as core from "@shapeshiftoss/hdwallet-core";
import { NativeBTCWallet, NativeBTCWalletInfo } from "./bitcoin";
import { NativeETHWallet, NativeETHWalletInfo } from "./ethereum";

export class NativeHDWalletInfo implements core.HDWalletInfo {
  _supportsBTCInfo: boolean = true;
  _supportsETHInfo: boolean = true;
  _supportsCosmosInfo: boolean = false;
  _supportsBinanceInfo: boolean = false;
  _supportsRippleInfo: boolean = false;
  _supportsEosInfo: boolean = false;

  getVendor(): string {
    return "Native";
  }

  hasOnDevicePinEntry(): boolean {
    return false;
  }

  hasOnDevicePassphrase(): boolean {
    return false;
  }

  hasOnDeviceDisplay(): boolean {
    return false;
  }

  hasOnDeviceRecovery(): boolean {
    return false;
  }

  hasNativeShapeShift(): boolean {
    return false;
  }

  describePath(msg: core.DescribePath): core.PathDescription {
    switch (msg.coin) {
      case "Ethereum":
        return core.describeETHPath(msg.path);
      case "Bitcoin":
        const info = new NativeBTCWalletInfo();
        const unknown = core.unknownUTXOPath(
          msg.path,
          msg.coin,
          msg.scriptType
        );

        if (!info.btcSupportsCoin(msg.coin)) return unknown;
        if (!info.btcSupportsScriptType(msg.coin, msg.scriptType))
          return unknown;

        return core.describeUTXOPath(msg.path, msg.coin, msg.scriptType);
      default:
        throw new Error("Unsupported path");
    }
  }
}

export interface NativeHDWalletInfo
  extends NativeBTCWalletInfo,
    NativeETHWalletInfo {}
core.applyMixins(NativeHDWalletInfo, [
  NativeBTCWalletInfo,
  NativeETHWalletInfo,
]);

export class NativeHDWallet extends NativeHDWalletInfo
  implements core.HDWallet {
  _supportsBTC = true;
  _supportsETH = true;
  _supportsCosmos = false;
  _supportsBinance = false;
  _supportsRipple = false;
  _supportsEos = false;
  _supportsDebugLink = false;
  _isNative = true;

  deviceId: string;

  private mnemonic: string;

  constructor(mnemonic: string, deviceId: string) {
    super();
    this.mnemonic = mnemonic;
    this.deviceId = deviceId;
  }

  async getDeviceID(): Promise<string> {
    return Promise.resolve(this.deviceId);
  }

  async getFirmwareVersion(): Promise<string> {
    return Promise.resolve("Software");
  }

  getModel(): Promise<string> {
    return Promise.resolve("Native");
  }

  getLabel(): Promise<string> {
    return Promise.resolve("Native");
  }

  async getPublicKeys(
    msg: Array<core.GetPublicKey>
  ): Promise<Array<core.PublicKey | null>> {
    // TODO: derive public keys from mnemonic
    return Promise.resolve([]);
  }

  async isInitialized(): Promise<boolean> {
    return Promise.resolve(true);
  }

  async isLocked(): Promise<boolean> {
    return Promise.resolve(false);
  }

  clearSession(): Promise<void> {
    return Promise.resolve();
  }

  initialize(): Promise<any> {
    return Promise.resolve();
  }

  ping(msg: core.Ping): Promise<core.Pong> {
    return Promise.resolve({ msg: msg.msg });
  }

  sendPin(): Promise<void> {
    return Promise.resolve();
  }

  sendPassphrase(): Promise<void> {
    return Promise.resolve();
  }

  sendCharacter(): Promise<void> {
    return Promise.resolve();
  }

  sendWord(): Promise<void> {
    return Promise.resolve();
  }

  cancel(): Promise<void> {
    return Promise.resolve();
  }

  wipe(): Promise<void> {
    return Promise.resolve();
  }

  reset(): Promise<void> {
    return Promise.resolve();
  }

  recover(): Promise<void> {
    return Promise.resolve();
  }

  loadDevice(msg: core.LoadDevice): Promise<void> {
    this.mnemonic = msg.mnemonic;
    return Promise.resolve();
  }

  disconnect(): Promise<void> {
    return Promise.resolve();
  }
}

export interface NativeHDWallet extends NativeBTCWallet, NativeETHWallet {}
core.applyMixins(NativeHDWallet, [NativeBTCWallet, NativeETHWallet]);

export function isNative(wallet: core.HDWallet): boolean {
  return wallet instanceof NativeHDWallet;
}

export function info() {
  return new NativeHDWalletInfo();
}

export function create(mnemonic: string, deviceId: string): NativeHDWallet {
  return new NativeHDWallet(mnemonic, deviceId);
}
