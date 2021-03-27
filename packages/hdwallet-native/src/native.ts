import * as core from "@shapeshiftoss/hdwallet-core";
import { EventEmitter2 } from "eventemitter2";
import { mnemonicToSeed, validateMnemonic } from "bip39";
import { fromSeed } from "bip32";
import { isObject } from "lodash";
import { getNetwork } from "./networks";
import { MixinNativeBTCWallet, MixinNativeBTCWalletInfo } from "./bitcoin";
import { MixinNativeETHWalletInfo, MixinNativeETHWallet } from "./ethereum";
import { MixinNativeCosmosWalletInfo, MixinNativeCosmosWallet } from "./cosmos";
import { MixinNativeBinanceWalletInfo, MixinNativeBinanceWallet } from "./binance";
import { MixinNativeFioWalletInfo, MixinNativeFioWallet } from "./fio";
import { MixinNativeThorchainWalletInfo, MixinNativeThorchainWallet } from "./thorchain";
import { MixinNativeSecretWalletInfo, MixinNativeSecretWallet } from "./secret";
// import { MixinNativeThorchainWalletInfo, MixinNativeThorchainWallet } from "./thorchain";
// import { MixinNativeThorchainWalletInfo, MixinNativeThorchainWallet } from "./thorchain";
// import { MixinNativeThorchainWalletInfo, MixinNativeThorchainWallet } from "./thorchain";

import type { NativeAdapterArgs } from "./adapter";

export enum NativeEvents {
  MNEMONIC_REQUIRED = "MNEMONIC_REQUIRED",
  READY = "READY",
}

interface LoadDevice extends core.LoadDevice {
  // Set this if your deviceId is dependent on the mnemonic
  deviceId?: string;
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

class NativeHDWalletInfo
  extends MixinNativeBTCWalletInfo(
    MixinNativeFioWalletInfo(
      MixinNativeETHWalletInfo(MixinNativeCosmosWalletInfo(MixinNativeBinanceWalletInfo(MixinNativeThorchainWalletInfo(MixinNativeSecretWalletInfo(NativeHDWalletBase)))))
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
  _supportsThorchainInfo: boolean = false;
  _supportsSecretInfo: boolean = true;
  _supportsSecret: boolean = true;
  _supportsKava: boolean = false;
  _supportsKavaInfo: boolean = false;
  _supportsTerra: boolean = false;
  _supportsTerraInfo: boolean = false;
  _supportsCardano: boolean = false;
  _supportsCardanoInfo: boolean = false;

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
      case "atom":
        return core.cosmosDescribePath(msg.path);
      case "rune":
      case "trune":
      case "thorchain":
        return core.thorchainDescribePath(msg.path);
      case "binance":
        return core.binanceDescribePath(msg.path);
      case "fio":
        return core.fioDescribePath(msg.path);
      default:
        throw new Error("Unsupported path");
    }
  }
}

export class NativeHDWallet
  extends MixinNativeBTCWallet(
    MixinNativeFioWallet(MixinNativeETHWallet(MixinNativeCosmosWallet(MixinNativeBinanceWallet(MixinNativeThorchainWallet(MixinNativeSecretWallet(NativeHDWalletInfo))))))
  )
  implements core.HDWallet, core.BTCWallet, core.ETHWallet, core.CosmosWallet, core.FioWallet, core.ThorchainWallet, core.SecretWallet {
  _supportsBTC = true;
  _supportsETH = true;
  _supportsCosmos = true;
  _supportsBinance = true;
  _supportsRipple = false;
  _supportsEos = false;
  _supportsFio = true;
  _supportsThorchain = true;
  _supportsDebugLink = false;
  _isNative = true;

  #deviceId: string;
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
   * @see: https://github.com/satoshilabs/slips/blob/master/slip-0132.md
   * to supports different styles of xpubs as can be defined by passing in a network to `fromSeed`
   */
  getPublicKeys(msg: Array<core.GetPublicKey>): Promise<core.PublicKey[]> {
    return this.needsMnemonic(!!this.#mnemonic, () =>
      Promise.all(
        msg.map(async (getPublicKey) => {
          let { addressNList } = getPublicKey;
          const seed = await mnemonicToSeed(this.#mnemonic);
          const network = getNetwork(getPublicKey.coin, getPublicKey.scriptType);
          const node = fromSeed(seed, network);
          const xpub = node
            .derivePath(core.addressNListToBIP32(core.hardenedPath(addressNList)))
            .neutered()
            .toBase58();
          return { xpub };
        })
      )
    );
  }

  async isInitialized(): Promise<boolean> {
    return this.#initialized;
  }

  async isLocked(): Promise<boolean> {
    return false;
  }

  async clearSession(): Promise<void> {}

  async initialize(): Promise<boolean> {
    return this.needsMnemonic(!!this.#mnemonic, async () => {
      try {
        const seed = await mnemonicToSeed(this.#mnemonic);

        await Promise.all([
          super.btcInitializeWallet(seed),
          super.ethInitializeWallet(seed),
          super.cosmosInitializeWallet(seed),
          super.binanceInitializeWallet(seed),
          super.fioInitializeWallet(seed),
          super.thorchainInitializeWallet(seed),
          super.secretInitializeWallet(seed),
        ]);

        this.#initialized = true;
      } catch (e) {
        console.error("NativeHDWallet:initialize:error", e);
        this.#initialized = false;
      }

      return this.#initialized;
    });
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
    super.thorchainWipe();
  }

  async reset(): Promise<void> {}

  async recover(): Promise<void> {}

  async loadDevice(msg: LoadDevice): Promise<void> {
    if (typeof msg?.mnemonic !== "string" || !validateMnemonic(msg.mnemonic))
      throw new Error("Required property [mnemonic] is missing or invalid");

    this.#mnemonic = msg.mnemonic;
    if (typeof msg.deviceId === "string") this.#deviceId = msg.deviceId;

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
