import * as core from "@shapeshiftoss/hdwallet-core";
import * as bip39 from "bip39";
import * as eventemitter2 from "eventemitter2";
import _ from "lodash";

import { MixinNativeBinanceWalletInfo, MixinNativeBinanceWallet } from "./binance";
import { MixinNativeBTCWallet, MixinNativeBTCWalletInfo } from "./bitcoin";
import { MixinNativeCosmosWalletInfo, MixinNativeCosmosWallet } from "./cosmos";
import { MixinNativeOsmosisWallet, MixinNativeOsmosisWalletInfo } from "./osmosis";
import { MixinNativeETHWalletInfo, MixinNativeETHWallet } from "./ethereum";
import { MixinNativeFioWalletInfo, MixinNativeFioWallet } from "./fio";
import { MixinNativeKavaWalletInfo, MixinNativeKavaWallet } from "./kava";
import { getNetwork } from "./networks";
import { MixinNativeSecretWalletInfo, MixinNativeSecretWallet } from "./secret";
import { MixinNativeTerraWalletInfo, MixinNativeTerraWallet } from "./terra";
import { MixinNativeThorchainWalletInfo, MixinNativeThorchainWallet } from "./thorchain";

import type { NativeAdapterArgs } from "./adapter";

export enum NativeEvents {
  MNEMONIC_REQUIRED = "MNEMONIC_REQUIRED",
  READY = "READY",
}

function isMnemonicInterface(x: unknown): x is any {
  return core.isIndexable(x) && typeof x.toSeed === "function";
}

type LoadDevice = Omit<core.LoadDevice, "mnemonic"> & {
  // Set this if your deviceId is dependent on the mnemonic
  deviceId?: string;
} & ({
  mnemonic: string | any;
  masterKey?: never
} | {
  mnemonic?: never;
  masterKey: any;
})

export class NativeHDWalletInfoBase implements core.HDWalletInfo {
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

  public supportsOfflineSigning(): boolean {
    return true;
  }

  public supportsBroadcast(): boolean {
    return false;
  }

  describePath(msg: core.DescribePath): core.PathDescription {
    throw new Error("unreachable");
  }
}

export class NativeHDWalletBase extends NativeHDWalletInfoBase {
  readonly #events: eventemitter2.EventEmitter2;

  constructor() {
    super();
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
      MixinNativeETHWalletInfo(
        MixinNativeCosmosWalletInfo(
          MixinNativeBinanceWalletInfo(
            MixinNativeThorchainWalletInfo(
              MixinNativeSecretWalletInfo(
                MixinNativeTerraWalletInfo(MixinNativeKavaWalletInfo(MixinNativeOsmosisWalletInfo(NativeHDWalletBase)))
              )
            )
          )
        )
      )
    )
  )
  implements core.HDWalletInfo
{
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

        if (!msg.scriptType) return unknown;
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
      case "osmosis":
      case "osmo":
        return core.osmosisDescribePath(msg.path);
      case "fio":
        return core.fioDescribePath(msg.path);
      default:
        throw new Error("Unsupported path");
    }
  }
}

export class NativeHDWallet
  extends MixinNativeBTCWallet(
    MixinNativeFioWallet(
      MixinNativeETHWallet(
        MixinNativeCosmosWallet(
          MixinNativeBinanceWallet(
            MixinNativeThorchainWallet(
              MixinNativeSecretWallet(
                MixinNativeTerraWallet(MixinNativeKavaWallet(MixinNativeOsmosisWallet(NativeHDWalletInfo)))
              )
            )
          )
        )
      )
    )
  )
  implements
    core.HDWallet,
    core.BTCWallet,
    core.ETHWallet,
    core.CosmosWallet,
    core.OsmosisWallet,
    core.FioWallet,
    core.ThorchainWallet,
    core.SecretWallet,
    core.TerraWallet,
    core.KavaWallet
{
  readonly _supportsBTC = true;
  readonly _supportsETH = true;
  readonly _supportsCosmos = true;
  readonly _supportsOsmosis = true;
  readonly _supportsBinance = true;
  readonly _supportsFio = true;
  readonly _supportsThorchain = true;
  readonly _supportsSecret = true;
  readonly _supportsTerra = true;
  readonly _supportsKava = true;
  readonly _isNative = true;

  #deviceId: string;
  #initialized: boolean = false;
  #masterKey: Promise<any> | undefined = undefined;

  constructor({ mnemonic, deviceId, masterKey }: NativeAdapterArgs) {
    super();
    if (masterKey) {
      this.#masterKey = Promise.resolve(masterKey);
    } else if (mnemonic) {
      this.#masterKey = (async () => {
        return "nerf"
      })()
    }
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
  async getPublicKeys(msg: Array<core.GetPublicKey>): Promise<core.PublicKey[] | null> {
    return this.needsMnemonic(!!this.#masterKey, async () => {
      const masterKey = await this.#masterKey!;
      return await Promise.all(
        msg.map(async (getPublicKey) => {
          return { xpub:"xpub6D1weXBcFAo8CqBbpP4TbH5sxQH8ZkqC5pDEvJ95rNNBZC9zrKmZP2fXMuve7ZRBe18pWQQsGg68jkq24mZchHwYENd8cCiSb71u3KD4AFH" };
        })
      )
    });
  }

  async isInitialized(): Promise<boolean> {
    return !!this.#initialized;
  }

  async isLocked(): Promise<boolean> {
    return false;
  }

  async clearSession(): Promise<void> {}

  async initialize(): Promise<boolean | null> {
    return this.needsMnemonic(!!this.#masterKey, async () => {
      const masterKey = await this.#masterKey!;
      try {
        await Promise.all([
          super.btcInitializeWallet(masterKey),
          super.ethInitializeWallet(masterKey),
          super.cosmosInitializeWallet(masterKey),
          super.osmosisInitializeWallet(masterKey),
          super.binanceInitializeWallet(masterKey),
          super.fioInitializeWallet(masterKey),
          super.thorchainInitializeWallet(masterKey),
          super.secretInitializeWallet(masterKey),
          super.terraInitializeWallet(masterKey),
          super.kavaInitializeWallet(masterKey),
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
    const oldMasterKey = this.#masterKey;
    this.#initialized = false;
    this.#masterKey = undefined;

    super.btcWipe();
    super.ethWipe();
    super.cosmosWipe();
    super.osmosisWipe();
    super.binanceWipe();
    super.fioWipe();
    super.thorchainWipe();
    super.secretWipe();
    super.terraWipe();
    super.kavaWipe();

    (await oldMasterKey)?.revoke?.()
  }

  async reset(): Promise<void> {}

  async recover(): Promise<void> {}

  async loadDevice(msg?: LoadDevice): Promise<void> {
    return
  }

  async disconnect(): Promise<void> {
    await this.wipe();
  }
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
