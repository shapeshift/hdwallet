import * as core from "@shapeshiftoss/hdwallet-core";
import { mnemonicToSeed } from "bip39";
import { fromSeed } from "bip32";
import { isObject } from "lodash";
import { getNetwork } from "./networks";
import { MixinNativeBTCWallet, MixinNativeBTCWalletInfo } from "./bitcoin";
import { MixinNativeETHWalletInfo, MixinNativeETHWallet } from "./ethereum";

class NativeHDWalletInfo extends MixinNativeBTCWalletInfo(MixinNativeETHWalletInfo(class Base {}))
  implements core.HDWalletInfo {
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
    switch (msg.coin.toLowerCase()) {
      case "bitcoin":
      case "bitcoincash":
      case "dash":
      case "digibyte":
      case "dogecoin":
      case "litecoin":
      case "testnet":
        const unknown = core.unknownUTXOPath(msg.path, msg.coin, msg.scriptType);

        if (!super.btcSupportsCoin(msg.coin)) return unknown;
        if (!super.btcSupportsScriptType(msg.coin, msg.scriptType)) return unknown;

        return core.describeUTXOPath(msg.path, msg.coin, msg.scriptType);
      case "ethereum":
        return core.describeETHPath(msg.path);
      default:
        throw new Error("Unsupported path");
    }
  }
}

export class NativeHDWallet extends MixinNativeBTCWallet(MixinNativeETHWallet(NativeHDWalletInfo))
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
  initialized: boolean;

  private mnemonic: string;

  constructor(mnemonic: string, deviceId: string, seed?: string) {
    super();
    console.log("constructing native wallet for device ", deviceId);
    this.mnemonic = mnemonic;
    this.deviceId = deviceId;
  }

  async getDeviceID(): Promise<string> {
    return this.deviceId;
  }

  async getFirmwareVersion(): Promise<string> {
    return "Software";
  }

  async getModel(): Promise<string> {
    return "Native";
  }

  async getLabel(): Promise<string> {
    return "Native";
  }

  /*
   * @see: https://github.com/satoshilabs/slips/blob/master/slip-0132.md
   * to supports different styles of xpubs as can be defined by passing in a network to `fromSeed`
   */
  getPublicKeys(msg: Array<core.GetPublicKey>): Promise<Array<core.PublicKey>> {
    return Promise.all(
      msg.map(async (getPublicKey) => {
        let { addressNList } = getPublicKey;
        const seed = await mnemonicToSeed(this.mnemonic);
        const network = getNetwork(getPublicKey.coin, getPublicKey.scriptType);
        const node = fromSeed(seed, network);
        const xpub = node
          .derivePath(core.addressNListToBIP32(core.hardenedPath(addressNList)))
          .neutered()
          .toBase58();
        return { xpub };
      })
    );
  }

  async isInitialized(): Promise<boolean> {
    return this.initialized;
  }

  async isLocked(): Promise<boolean> {
    return false;
  }

  async clearSession(): Promise<void> {}

  async initialize(): Promise<any> {
    const start = Date.now();
    const seed = await mnemonicToSeed(this.mnemonic);
    console.log(`converted  mnemonicToSeed in ${Date.now() - start}ms`);
    const estart = Date.now();
    super.ethInitializeWallet("0x" + seed.toString("hex"));
    console.log(`initializedEthWallet in ${Date.now() - estart}ms`);
    const bstart = Date.now();
    await super.btcInitializeWallet(seed);
    console.log(`initializedBtcWallet in ${Date.now() - bstart}ms`);
    this.initialized = true;
    console.log(`Native.initialize done in ${Date.now() - start}ms`);
  }

  async ping(msg: core.Ping): Promise<core.Pong> {
    return { msg: msg.msg };
  }

  async sendPin(): Promise<void> {}

  async sendPassphrase(): Promise<void> {}

  async sendCharacter(): Promise<void> {}

  async sendWord(): Promise<void> {}

  async cancel(): Promise<void> {}

  async wipe(): Promise<void> {}

  async reset(): Promise<void> {}

  async recover(): Promise<void> {}

  async loadDevice(msg: core.LoadDevice): Promise<void> {
    this.mnemonic = msg.mnemonic;
    this.initialized = false;
    await this.initialize();
  }

  async disconnect(): Promise<void> {}
}

export function isNative(wallet: core.HDWallet): wallet is NativeHDWallet {
  return isObject(wallet) && (wallet as any)._isNative;
}

export function info() {
  return new NativeHDWalletInfo();
}

export function create(mnemonic: string, deviceId: string): NativeHDWallet {
  return new NativeHDWallet(mnemonic, deviceId);
}
