import * as core from "@bithighlander/hdwallet-core";
import { mnemonicToSeed } from "bip39";
import { fromSeed } from "bip32";
import { isObject } from "lodash";
import { getNetwork } from "./networks";
import { MixinNativeBTCWallet, MixinNativeBTCWalletInfo } from "./bitcoin";
import { MixinNativeETHWalletInfo, MixinNativeETHWallet } from "./ethereum";
import { MixinNativeBinanceWalletInfo, MixinNativeBinanceWallet } from "./binance";
import { MixinNativeCosmosWalletInfo, MixinNativeCosmosWallet } from "./cosmos";
import { MixinNativeEosWalletInfo, MixinNativeEosWallet } from "./eos";

class NativeHDWalletInfo
  extends MixinNativeBTCWalletInfo(
    MixinNativeETHWalletInfo(
      MixinNativeBinanceWalletInfo(MixinNativeCosmosWalletInfo(MixinNativeEosWalletInfo(class Base {})))
    )
  )
  implements core.HDWalletInfo {
  _supportsBTCInfo: boolean = true;
  _supportsETHInfo: boolean = true;
  _supportsCosmosInfo: boolean = true;
  _supportsBinanceInfo: boolean = true;
  _supportsEosInfo: boolean = true;
  _supportsRippleInfo: boolean = false;

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
      case "eos":
        //TODO
        return core.describeETHPath(msg.path);
      case "cosmos":
        //TODO
        return core.describeETHPath(msg.path);
      case "binance":
        //TODO
        return core.describeETHPath(msg.path);
      default:
        throw new Error("Unsupported path");
    }
  }
}

export class NativeHDWallet
  extends MixinNativeBTCWallet(
    MixinNativeETHWallet(MixinNativeBinanceWallet(MixinNativeCosmosWallet(MixinNativeEosWallet(NativeHDWalletInfo))))
  )
  implements core.HDWallet {
  _supportsBTC = true;
  _supportsETH = true;
  _supportsCosmos = true;
  _supportsBinance = true;
  _supportsEos = true;
  _supportsRipple = false;
  _supportsDebugLink = false;
  _isNative = true;

  readonly #deviceId: string;
  #initialized: boolean;
  #mnemonic: string;

  constructor(mnemonic: string, deviceId: string) {
    super();
    this.#mnemonic = mnemonic;
    this.#deviceId = deviceId;
  }

  async getDeviceID(): Promise<string> {
    return this.#deviceId;
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
   *   Verbose Pubkey Info
   *      Goals: provide all pertinent info "at a given path"
   *
   *
   * @see: https://github.com/satoshilabs/slips/blob/master/slip-0132.md
   * to supports different styles of xpubs as can be defined by passing in a network to `fromSeed`
   */
  async getPublicKeys(msg: Array<core.GetPublicKey>): Promise<Array<core.PublicKey>> {
    return Promise.all(
      msg.map(async (getPublicKey) => {
        let { addressNList } = getPublicKey;
        const seed = await mnemonicToSeed(this.#mnemonic);

        const network = getNetwork("bitcoin", getPublicKey.scriptType);
        const node = fromSeed(seed, network);
        const xpub = node.derivePath(core.addressNListToBIP32(addressNList)).neutered().toBase58();

        let addressInfo: core.GetAddress = {
          path: core.hardenedPath(addressNList),
          coin: getPublicKey.coin.toLowerCase(),
          scriptType: getPublicKey.script_type,
        };

        let pubkey: core.PublicKey = {
          coin: getPublicKey.network,
          network: getPublicKey.network,
          script_type: getPublicKey.script_type,
          path: core.addressNListToBIP32(core.hardenedPath(addressNList)),
          long: getPublicKey.coin,
          address: await this.getAddress(addressInfo),
          master: await this.getAddress(addressInfo),
          type: getPublicKey.type,
          xpub,
        };
        if (getPublicKey.type == "address") {
          pubkey.pubkey = pubkey.address;
        } else {
          pubkey.pubkey = pubkey.xpub;
        }

        return pubkey;
      })
    );
  }

  getAddress(msg: core.GetAddress): Promise<string> {
    switch (msg.coin.toLowerCase()) {
      case "bitcoin":
      case "bitcoincash":
      case "dash":
      case "digibyte":
      case "dogecoin":
      case "litecoin":
      case "testnet":
        let inputClone: core.BTCAccountPath = {
          addressNList: msg.path,
          coin: msg.coin,
          scriptType: msg.scriptType,
        };
        return super.btcGetAddress(inputClone);
      case "ethereum":
        let inputETH: core.BTCAccountPath = {
          addressNList: msg.path,
          coin: msg.coin,
          scriptType: msg.scriptType,
        };
        return super.ethGetAddress(inputETH);
      case "eos":
        let inputEOS: core.EosAccountPath = {
          addressNList: msg.path,
        };
        return super.eosGetAddress(inputEOS);
      case "cosmos":
        let inputATOM: core.CosmosGetAddress = {
          addressNList: msg.path,
        };
        return super.cosmosGetAddress(inputATOM);
      case "binance":
        let inputBNB: core.EosAccountPath = {
          addressNList: msg.path,
        };
        return super.binanceGetAddress(inputBNB);
      default:
        throw new Error("Unsupported path " + msg.coin);
    }
  }

  async isInitialized(): Promise<boolean> {
    return this.#initialized;
  }

  async isLocked(): Promise<boolean> {
    return false;
  }

  async clearSession(): Promise<void> {}

  async initialize(): Promise<any> {
    const seed = await mnemonicToSeed(this.#mnemonic);
    super.binanceInitializeWallet(this.#mnemonic);
    super.eosInitializeWallet(this.#mnemonic);
    super.ethInitializeWallet("0x" + seed.toString("hex"));
    await super.btcInitializeWallet(seed);
    this.#initialized = true;
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
    this.#mnemonic = msg.mnemonic;
    this.#initialized = false;
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
