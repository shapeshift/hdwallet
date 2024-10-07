import * as core from "@shapeshiftoss/hdwallet-core";
import * as bip39 from "bip39";
import * as eventemitter2 from "eventemitter2";
import isObject from "lodash/isObject";

import type { NativeAdapterArgs } from "./adapter";
import { MixinNativeArkeoWallet, MixinNativeArkeoWalletInfo } from "./arkeo";
import { MixinNativeBinanceWallet, MixinNativeBinanceWalletInfo } from "./binance";
import { MixinNativeBTCWallet, MixinNativeBTCWalletInfo } from "./bitcoin";
import { MixinNativeCosmosWallet, MixinNativeCosmosWalletInfo } from "./cosmos";
import * as Isolation from "./crypto/isolation";
import { MixinNativeETHWallet, MixinNativeETHWalletInfo } from "./ethereum";
import { MixinNativeFioWallet, MixinNativeFioWalletInfo } from "./fio";
import { MixinNativeKavaWallet, MixinNativeKavaWalletInfo } from "./kava";
import { getNetwork } from "./networks";
import { MixinNativeOsmosisWallet, MixinNativeOsmosisWalletInfo } from "./osmosis";
import { MixinNativeSecretWallet, MixinNativeSecretWalletInfo } from "./secret";
import { MixinNativeTerraWallet, MixinNativeTerraWalletInfo } from "./terra";
import { MixinNativeThorchainWallet, MixinNativeThorchainWalletInfo } from "./thorchain";

export enum NativeEvents {
  MNEMONIC_REQUIRED = "MNEMONIC_REQUIRED",
  READY = "READY",
}

function isMnemonicInterface(x: unknown): x is Isolation.Core.BIP39.Mnemonic {
  return core.isIndexable(x) && typeof x.toSeed === "function";
}

type LoadDevice = Omit<core.LoadDevice, "mnemonic"> & {
  // Set this if your deviceId is dependent on the mnemonic
  deviceId?: string;
} & (
    | {
        mnemonic: string | Isolation.Core.BIP39.Mnemonic;
        masterKey?: never;
      }
    | {
        mnemonic?: never;
        masterKey: Isolation.Core.BIP32.Node;
      }
  );

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

  public supportsBip44Accounts(): boolean {
    return true;
  }

  public supportsOfflineSigning(): boolean {
    return true;
  }

  public supportsBroadcast(): boolean {
    return false;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
                MixinNativeTerraWalletInfo(
                  MixinNativeKavaWalletInfo(
                    MixinNativeArkeoWalletInfo(MixinNativeOsmosisWalletInfo(NativeHDWalletBase))
                  )
                )
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
      case "testnet": {
        const unknown = core.unknownUTXOPath(msg.path, msg.coin, msg.scriptType);

        if (!msg.scriptType) return unknown;
        if (!super.btcSupportsCoinSync(msg.coin)) return unknown;
        if (!super.btcSupportsScriptTypeSync(msg.coin, msg.scriptType)) return unknown;

        return core.describeUTXOPath(msg.path, msg.coin, msg.scriptType);
      }
      case "ethereum":
        return core.describeETHPath(msg.path);
      case "atom":
        return core.cosmosDescribePath(msg.path);
      case "rune":
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
      case "arkeo":
        return core.arkeoDescribePath(msg.path);
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
                MixinNativeTerraWallet(
                  MixinNativeKavaWallet(MixinNativeOsmosisWallet(MixinNativeArkeoWallet(NativeHDWalletInfo)))
                )
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
    core.KavaWallet,
    core.ArkeoWallet
{
  readonly _supportsBTC = true;
  readonly _supportsETH = true;
  readonly _supportsCosmos = true;
  readonly _supportsEthSwitchChain = false;
  readonly _supportsAvalanche = true;
  readonly _supportsOptimism = true;
  readonly _supportsBSC = true;
  readonly _supportsPolygon = true;
  readonly _supportsGnosis = true;
  readonly _supportsArbitrum = true;
  readonly _supportsArbitrumNova = true;
  readonly _supportsBase = true;
  readonly _supportsOsmosis = true;
  readonly _supportsBinance = true;
  readonly _supportsFio = true;
  readonly _supportsThorchain = true;
  readonly _supportsSecret = true;
  readonly _supportsTerra = true;
  readonly _supportsKava = true;
  readonly _supportsArkeo = true;
  readonly _isNative = true;

  #deviceId: string;
  #initialized = false;
  #masterKey: Promise<Isolation.Core.BIP32.Node> | undefined = undefined;

  constructor({ mnemonic, deviceId, masterKey }: NativeAdapterArgs) {
    super();
    if (masterKey) {
      this.#masterKey = Promise.resolve(masterKey);
    } else if (mnemonic) {
      this.#masterKey = (async () => {
        const isolatedMnemonic =
          typeof mnemonic === "string" ? await Isolation.Engines.Default.BIP39.Mnemonic.create(mnemonic) : mnemonic;
        const seed = await isolatedMnemonic.toSeed();
        return await seed.toMasterKey();
      })();
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
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const masterKey = await this.#masterKey!;
      return await Promise.all(
        msg.map(async (getPublicKey) => {
          const { addressNList } = getPublicKey;
          const network = getNetwork(getPublicKey.coin, getPublicKey.scriptType);
          // TODO: return the xpub that's actually asked for, not the key of the hardened path
          // It's done this way for hilarious historical reasons and will break ETH if fixed
          const hardenedPath = core.hardenedPath(addressNList);
          let node = await Isolation.Adapters.BIP32.create(masterKey, network);
          if (hardenedPath.length > 0) node = await node.derivePath(core.addressNListToBIP32(hardenedPath));
          const xpub = node.neutered().toBase58();
          return { xpub };
        })
      );
    });
  }

  async isInitialized(): Promise<boolean> {
    return !!this.#initialized;
  }

  async isLocked(): Promise<boolean> {
    return false;
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async clearSession(): Promise<void> {}

  async initialize(): Promise<boolean | null> {
    return this.needsMnemonic(!!this.#masterKey, async () => {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
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
          super.arkeoInitializeWallet(masterKey),
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

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async sendPin(): Promise<void> {}

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async sendPassphrase(): Promise<void> {}

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async sendCharacter(): Promise<void> {}

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async sendWord(): Promise<void> {}

  // eslint-disable-next-line @typescript-eslint/no-empty-function
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
    super.arkeoWipe();

    (await oldMasterKey)?.revoke?.();
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async reset(): Promise<void> {}

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async recover(): Promise<void> {}

  async loadDevice(msg?: LoadDevice): Promise<void> {
    this.#masterKey = Promise.resolve(
      await (async (mnemonic, masterKey) => {
        if (masterKey !== undefined) {
          return masterKey;
        } else if (mnemonic !== undefined) {
          const isolatedMnemonic = await (async () => {
            if (isMnemonicInterface(mnemonic)) return mnemonic;
            if (typeof mnemonic === "string" && bip39.validateMnemonic(mnemonic)) {
              return await Isolation.Engines.Default.BIP39.Mnemonic.create(mnemonic);
            }
            throw new Error("Required property [mnemonic] is invalid");
          })();
          const seed = await isolatedMnemonic.toSeed();
          seed.addRevoker?.(() => isolatedMnemonic.revoke?.());
          const out = await seed.toMasterKey();
          out.addRevoker?.(() => seed.revoke?.());
          return out;
        }
        throw new Error("Either [mnemonic] or [masterKey] is required");
      })(msg?.mnemonic, msg?.masterKey)
    );

    if (typeof msg?.deviceId === "string") this.#deviceId = msg?.deviceId;

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

  async disconnect(): Promise<void> {
    await this.wipe();
  }
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
