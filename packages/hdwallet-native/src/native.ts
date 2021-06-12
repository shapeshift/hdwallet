import * as core from "@shapeshiftoss/hdwallet-core";
import * as bip39 from "bip39";
import * as eventemitter2 from "eventemitter2";
import _ from "lodash";

import { MixinNativeBinanceWalletInfo, MixinNativeBinanceWallet } from "./binance";
import { MixinNativeBTCWallet, MixinNativeBTCWalletInfo } from "./bitcoin";
import { MixinNativeCosmosWalletInfo, MixinNativeCosmosWallet } from "./cosmos";
import { MixinNativeETHWalletInfo, MixinNativeETHWallet } from "./ethereum";
import { MixinNativeFioWalletInfo, MixinNativeFioWallet } from "./fio";
import { MixinNativeKavaWalletInfo, MixinNativeKavaWallet } from "./kava";
import { getNetwork } from "./networks";
import { MixinNativeSecretWalletInfo, MixinNativeSecretWallet } from "./secret";
import { MixinNativeTerraWalletInfo, MixinNativeTerraWallet } from "./terra";
import { MixinNativeThorchainWalletInfo, MixinNativeThorchainWallet } from "./thorchain";

import type { NativeAdapterArgs } from "./adapter";
import * as Isolation from "./crypto/isolation";

export enum NativeEvents {
  MNEMONIC_REQUIRED = "MNEMONIC_REQUIRED",
  READY = "READY",
}

interface LoadDevice extends Omit<core.LoadDevice, "mnemonic"> {
  // Set this if your deviceId is dependent on the mnemonic
  deviceId?: string;
  mnemonic: string | Isolation.BIP39.MnemonicInterface;
}

export class NativeHDWalletBase {
  readonly #events: eventemitter2.EventEmitter2;

  constructor() {
    this.#events = new eventemitter2.EventEmitter2();
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
      MixinNativeETHWalletInfo(MixinNativeCosmosWalletInfo(MixinNativeBinanceWalletInfo(MixinNativeThorchainWalletInfo(MixinNativeSecretWalletInfo(MixinNativeTerraWalletInfo(MixinNativeKavaWalletInfo(NativeHDWalletBase)))))))
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
  _supportsThorchainInfo: boolean = true;
  _supportsSecretInfo: boolean = true;
  _supportsKavaInfo: boolean = true;
  _supportsTerraInfo: boolean = true;

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

        if (!super.btcSupportsCoinSync(msg.coin)) return unknown;
        if (!super.btcSupportsScriptTypeSync(msg.coin, msg.scriptType)) return unknown;

        return core.describeUTXOPath(msg.path, msg.coin, msg.scriptType);
      case "ethereum":
        return core.describeETHPath(msg.path);
      case "atom":
        return core.cosmosDescribePath(msg.path);
      case "rune":
      case "trune":
      case "thorchain":
        return core.thorchainDescribePath(msg.path);
      case "secret":
      case "scrt":
      case "tscrt":
        return core.secretDescribePath(msg.path);
      case "luna":
      case "terra":
      case "tluna":
        return core.terraDescribePath(msg.path);
      case "kava":
      case "tkava":
        return core.kavaDescribePath(msg.path);
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
    MixinNativeFioWallet(MixinNativeETHWallet(MixinNativeCosmosWallet(MixinNativeBinanceWallet(MixinNativeThorchainWallet(MixinNativeSecretWallet(MixinNativeTerraWallet(MixinNativeKavaWallet(NativeHDWalletInfo))))))))
  )
  implements core.HDWallet, core.BTCWallet, core.ETHWallet, core.CosmosWallet, core.FioWallet, core.ThorchainWallet, core.SecretWallet, core.TerraWallet, core.KavaWallet {
  _supportsBTC = true;
  _supportsETH = true;
  _supportsCosmos = true;
  _supportsBinance = true;
  _supportsRipple = false;
  _supportsEos = false;
  _supportsFio = true;
  _supportsThorchain = true;
  _supportsSecret = true;
  _supportsTerra = true;
  _supportsKava = true;
  _supportsDebugLink = false;
  _isNative = true;

  #deviceId: string;
  #initialized: boolean;
  #mnemonic: Isolation.BIP39.MnemonicInterface;

  constructor({ mnemonic, deviceId }: NativeAdapterArgs) {
    super();
    this.#mnemonic = (typeof mnemonic == "string" ? new Isolation.BIP39.Mnemonic(mnemonic) : mnemonic);
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
          const seed = this.#mnemonic.toSeed();
          const network = getNetwork(getPublicKey.coin, getPublicKey.scriptType);
          const hardenedPath = core.hardenedPath(addressNList);
          let node = new Isolation.Adapters.BIP32(seed.toMasterKey(), network);
          if (hardenedPath.length > 0) node = node.derivePath(core.addressNListToBIP32(hardenedPath));
          const xpub = node.neutered().toBase58();
          return { xpub };
        })
      )
    );
  }

  async isInitialized(): Promise<boolean> {
    return !!this.#initialized;
  }

  async isLocked(): Promise<boolean> {
    return false;
  }

  async clearSession(): Promise<void> {}

  async initialize(): Promise<boolean> {
    return this.needsMnemonic(!!this.#mnemonic, async () => {
      try {
        const seed = this.#mnemonic.toSeed();

        await Promise.all([
          super.btcInitializeWallet(seed),
          super.ethInitializeWallet(seed),
          super.cosmosInitializeWallet(seed),
          super.binanceInitializeWallet(seed),
          super.fioInitializeWallet(seed),
          super.thorchainInitializeWallet(seed),
          super.secretInitializeWallet(seed),
          super.terraInitializeWallet(seed),
          super.kavaInitializeWallet(seed),
        ]);

        this.#initialized = true;
      } catch (e) {
        console.error("NativeHDWallet:initialize:error", e);
        this.#initialized = false;
        await this.wipe();
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
    this.#initialized = false;
    this.#mnemonic = null;

    super.btcWipe();
    super.ethWipe();
    super.cosmosWipe();
    super.binanceWipe();
    super.fioWipe();
    super.thorchainWipe();
    super.secretWipe();
    super.terraWipe();
    super.kavaWipe();
  }

  async reset(): Promise<void> {}

  async recover(): Promise<void> {}

  async loadDevice(msg: LoadDevice): Promise<void> {
    if (typeof msg?.mnemonic === "string" && bip39.validateMnemonic(msg.mnemonic)) {
      this.#mnemonic = new Isolation.BIP39.Mnemonic(msg.mnemonic);
    } else if (typeof msg?.mnemonic?.["toSeed"] === "function") {
      this.#mnemonic = msg.mnemonic as Isolation.BIP39.MnemonicInterface;
    } else {
      throw new Error("Required property [mnemonic] is missing or invalid");
    }

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
  return _.isObject(wallet) && (wallet as any)._isNative;
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
