import * as core from "@shapeshiftoss/hdwallet-core";

export class NativeHDWalletInfo implements core.HDWalletInfo {
  _supportsBTCInfo: boolean = true;
  _supportsETHInfo: boolean = true;
  _supportsCosmosInfo: boolean = false;
  _supportsBinanceInfo: boolean = false;
  _supportsRippleInfo: boolean = false;
  _supportsEosInfo: boolean = false;

  public getVendor(): string {
    return "Native";
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
    // TODO: support native shapeshift
    return false;
  }

  public describePath(msg: core.DescribePath): core.PathDescription {
    switch (msg.coin) {
      case "Ethereum":
        // TODO: return eth path description
        return null;
      case "Bitcoin":
        // TODO: return btc path description
        return null;
      default:
        throw new Error("Unsupported path");
    }
  }
}

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

  mnemonic: string;

  constructor() {
    super();
  }

  public async getDeviceID(): Promise<string> {
    // TODO: uuid
    return Promise.resolve("Native");
  }

  public async getFirmwareVersion(): Promise<string> {
    return Promise.resolve("Native");
  }

  public getModel(): Promise<string> {
    return Promise.resolve("Native");
  }

  public getLabel(): Promise<string> {
    return Promise.resolve("Native");
  }

  public async getPublicKeys(
    msg: Array<core.GetPublicKey>
  ): Promise<Array<core.PublicKey | null>> {
    // TODO: derive public keys from mnemonic
    return Promise.resolve([]);
  }

  public async isInitialized(): Promise<boolean> {
    return Promise.resolve(true);
  }

  public async isLocked(): Promise<boolean> {
    return Promise.resolve(false);
  }

  public clearSession(): Promise<void> {
    // TODO: what does it mean to clear session and lock wallet
    return;
  }

  public initialize(): Promise<any> {
    // TODO: what does it mean to initialize
    return;
  }

  public ping(msg: core.Ping): Promise<core.Pong> {
    return Promise.resolve({ msg: msg.msg });
  }

  public sendPin(): Promise<void> {
    return;
  }

  public sendPassphrase(): Promise<void> {
    return;
  }

  public sendCharacter(): Promise<void> {
    return;
  }

  public sendWord(): Promise<void> {
    return;
  }

  public cancel(): Promise<void> {
    return;
  }

  public wipe(): Promise<void> {
    return;
  }

  public reset(msg: core.ResetDevice): Promise<void> {
    return;
  }

  public recover(): Promise<void> {
    return;
  }

  public loadDevice(msg: core.LoadDevice): Promise<void> {
    this.mnemonic = msg.mnemonic;
    return;
  }

  public disconnect(): Promise<void> {
    return;
  }
}

export function isNative(wallet: core.HDWallet): boolean {
  return wallet instanceof NativeHDWallet;
}

export function info() {
  return new NativeHDWalletInfo();
}

export function create(): NativeHDWallet {
  return new NativeHDWallet();
}
