import * as core from "@shapeshiftoss/hdwallet-core";
import { EventEmitter2 } from "eventemitter2";
import * as core from "@bithighlander/hdwallet-core";
import { mnemonicToSeed } from "bip39";
import { fromSeed } from "bip32";
import { isObject } from "lodash";
import { getNetwork } from "./networks";
import { MixinNativeBTCWallet, MixinNativeBTCWalletInfo } from "./bitcoin";
import { MixinNativeBinanceWalletInfo, MixinNativeBinanceWallet } from "./binance";
import { MixinNativeETHWalletInfo, MixinNativeETHWallet } from "./ethereum";
import { MixinNativeCosmosWalletInfo, MixinNativeCosmosWallet } from "./cosmos";
import { MixinNativeBinanceWalletInfo, MixinNativeBinanceWallet } from "./binance";
import type { NativeAdapterArgs } from "./adapter";

export enum NativeEvents {
  MNEMONIC_REQUIRED = "MNEMONIC_REQUIRED",
  READY = "READY",
}

export class NativeHDWalletBase {
  readonly #events: EventEmitter2;

  constructor() {
    this.#events = new EventEmitter2();
  }

  get events() {
    return this.#events;
  }

  /**
   * Wrap a function call that needs a mnemonic seed
   * Raise an event if the wallet hasn't been initialized with a mnemonic seed
   */
  needsMnemonic<T>(hasMnemonic: boolean, callback: () => T): T | null {
    if (hasMnemonic) {
      return callback();
    }

    this.#events.emit(
      NativeEvents.MNEMONIC_REQUIRED,
      core.makeEvent({
        message_type: NativeEvents.MNEMONIC_REQUIRED,
        from_wallet: true,
      })
    );

    return null;
  }
}
import { MixinNativeEosWalletInfo, MixinNativeEosWallet } from "./eos";
import { MixinNativeFioWalletInfo, MixinNativeFioWallet } from "./fio";

class NativeHDWalletInfo
  extends MixinNativeBTCWalletInfo(
    MixinNativeETHWalletInfo(
      MixinNativeBinanceWalletInfo(
        MixinNativeCosmosWalletInfo(
          MixinNativeEosWalletInfo(
            MixinNativeFioWalletInfo(
              class Base {}
            )
          )
        )
      )
    )
  )
  implements core.HDWalletInfo {
  _supportsBTCInfo: boolean = true;
  _supportsETHInfo: boolean = true;
  _supportsCosmosInfo: boolean = true;
  _supportsBinanceInfo: boolean = true;
  _supportsRippleInfo: boolean = false;
  _supportsEosInfo: boolean = false;
  _supportsFioInfo: boolean = false;

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
      //TODO below wrong
      case "cosmos":
        return core.describeETHPath(msg.path);
      case "binance":
        return core.describeETHPath(msg.path);
      case "eos":
        return core.describeETHPath(msg.path);
      case "atom":
        return core.cosmosDescribePath(msg.path);
      case "binance":
        return core.binanceDescribePath(msg.path);
      default:
        throw new Error("Unsupported path");
    }
  }
}

export class NativeHDWallet
  extends MixinNativeBTCWallet(
    MixinNativeETHWallet(MixinNativeCosmosWallet(MixinNativeBinanceWallet(NativeHDWalletInfo)))
  )
  extends MixinNativeBTCWallet(
    MixinNativeETHWallet(
      MixinNativeBinanceWallet(
        MixinNativeCosmosWallet(
          MixinNativeFioWallet(
            MixinNativeEosWallet(NativeHDWalletInfo)
          )
        )
      )
    )
  )
  implements core.HDWallet, core.BTCWallet, core.ETHWallet, core.CosmosWallet {
  _supportsBTC = true;
  _supportsETH = true;
  _supportsCosmos = true;
  _supportsBinance = true;
  _supportsRipple = false;
  _supportsEos = false;
  _supportsDebugLink = false;
  _isNative = true;

  readonly #deviceId: string;
  #initialized: boolean;
  #mnemonic: string;

  constructor({ mnemonic, deviceId }: NativeAdapterArgs) {
    super();
    this.#mnemonic = mnemonic;
    this.#deviceId = deviceId;
  }

  async getFeatures(): Promise<Record<string, any>> {
    return {};
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
          path: addressNList,
          coin: getPublicKey.coin.toLowerCase(),
          scriptType: getPublicKey.script_type,
        };

        let pubkey: core.PublicKey = {
          coin: getPublicKey.network,
          network: getPublicKey.network,
          script_type: getPublicKey.script_type,
          path: core.addressNListToBIP32(addressNList),
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
      case "fio":
        let inputFIO: core.FioAccountPath = {
          addressNList: msg.path,
        };
        return super.fioGetAddress(inputFIO);
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

    await super.btcInitializeWallet(seed);
    super.ethInitializeWallet(this.#mnemonic);
    super.cosmosInitializeWallet(this.#mnemonic);
    super.binanceInitializeWallet(this.#mnemonic);
    super.eosInitializeWallet(this.#mnemonic);
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

  async wipe(): Promise<void> {
    this.#mnemonic = null;

    super.btcWipe();
    super.ethWipe();
    super.cosmosWipe();
    super.binanceWipe();
  }

  async reset(): Promise<void> {}

  async recover(): Promise<void> {}

  async loadDevice(msg: core.LoadDevice): Promise<void> {
    this.#mnemonic = msg.mnemonic;
    this.#initialized = false;
    await this.initialize();

    // Once we've been seeded with a mnemonic we re-emit the connected event
    this.events.emit(
      NativeEvents.READY,
      core.makeEvent({
        message_type: NativeEvents.READY,
        from_wallet: true,
      })
    );
  }

  async disconnect(): Promise<void> {}
}

export function isNative(wallet: core.HDWallet): wallet is NativeHDWallet {
  return isObject(wallet) && (wallet as any)._isNative;
}

export function info() {
  return new NativeHDWalletInfo();
}

export function create(args: NativeAdapterArgs): NativeHDWallet {
  return new NativeHDWallet(args);
}

// This prevents any malicious code from overwriting the prototype
// to potentially steal the mnemonic when calling "loadDevice"
Object.freeze(Object.getPrototypeOf(NativeHDWallet));
