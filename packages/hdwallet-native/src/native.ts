import * as core from "@shapeshiftoss/hdwallet-core";
import * as bip39 from "bip39";
import base58 from "bs58";
import * as eventemitter2 from "eventemitter2";
import isObject from "lodash/isObject";

import type { NativeAdapterArgs } from "./adapter";
import { MixinNativeArkeoWallet, MixinNativeArkeoWalletInfo } from "./arkeo";
import { MixinNativeBinanceWallet, MixinNativeBinanceWalletInfo } from "./binance";
import { MixinNativeBTCWallet, MixinNativeBTCWalletInfo } from "./bitcoin";
import { MixinNativeCosmosWallet, MixinNativeCosmosWalletInfo } from "./cosmos";
import * as Isolation from "./crypto/isolation";
import { MixinNativeETHWallet, MixinNativeETHWalletInfo } from "./ethereum";
import { MixinNativeKavaWallet, MixinNativeKavaWalletInfo } from "./kava";
import { getNetwork } from "./networks";
import { MixinNativeOsmosisWallet, MixinNativeOsmosisWalletInfo } from "./osmosis";
import { MixinNativeSecretWallet, MixinNativeSecretWalletInfo } from "./secret";
import { MixinNativeSolanaWallet, MixinNativeSolanaWalletInfo } from "./solana";
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
        secp256k1MasterKey?: never;
        ed25519MasterKey?: never;
      }
    | {
        mnemonic?: never;
        secp256k1MasterKey: Isolation.Core.BIP32.Node;
        ed25519MasterKey: Isolation.Core.Ed25519.Node;
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
    MixinNativeETHWalletInfo(
      MixinNativeCosmosWalletInfo(
        MixinNativeBinanceWalletInfo(
          MixinNativeSolanaWalletInfo(
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
      case "solana":
        return core.solanaDescribePath(msg.path);
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
      case "arkeo":
        return core.arkeoDescribePath(msg.path);
      default:
        throw new Error("Unsupported path");
    }
  }
}

export class NativeHDWallet
  extends MixinNativeBTCWallet(
    MixinNativeETHWallet(
      MixinNativeCosmosWallet(
        MixinNativeBinanceWallet(
          MixinNativeSolanaWallet(
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
    core.ThorchainWallet,
    core.SolanaWallet,
    core.SecretWallet,
    core.TerraWallet,
    core.KavaWallet,
    core.ArkeoWallet
{
  readonly _isNative = true;

  #deviceId: string;
  #initialized = false;
  #secp256k1MasterKey: Promise<Isolation.Core.BIP32.Node> | undefined = undefined;
  #ed25519MasterKey: Promise<Isolation.Core.Ed25519.Node> | undefined = undefined;

  constructor({ mnemonic, deviceId, secp256k1MasterKey, ed25519MasterKey }: NativeAdapterArgs) {
    super();
    if (mnemonic) {
      this.#secp256k1MasterKey = (async () => {
        const isolatedMnemonic =
          typeof mnemonic === "string" ? await Isolation.Engines.Default.BIP39.Mnemonic.create(mnemonic) : mnemonic;
        const seed = await isolatedMnemonic.toSeed();
        return await seed.toSecp256k1MasterKey();
      })();
      this.#ed25519MasterKey = (async () => {
        const isolatedMnemonic =
          typeof mnemonic === "string" ? await Isolation.Engines.Default.BIP39.Mnemonic.create(mnemonic) : mnemonic;
        const seed = await isolatedMnemonic.toSeed();
        return await seed.toEd25519MasterKey();
      })();
    } else {
      if (secp256k1MasterKey) this.#secp256k1MasterKey = Promise.resolve(secp256k1MasterKey);
      if (ed25519MasterKey) this.#ed25519MasterKey = Promise.resolve(ed25519MasterKey);
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
    return this.needsMnemonic(!!this.#secp256k1MasterKey && !!this.#ed25519MasterKey, async () => {
      const secp256k1MasterKey = await this.#secp256k1MasterKey!;
      const ed25519MasterKey = await this.#ed25519MasterKey!;

      return await Promise.all(
        msg.map(async (getPublicKey) => {
          const { addressNList, coin, curve, scriptType } = getPublicKey;

          switch (curve.toLowerCase()) {
            case "secp256k1": {
              // TODO: return the xpub that's actually asked for, not the key of the hardened path
              // It's done this way for hilarious historical reasons and will break ETH if fixed
              const hardenedPath = core.hardenedPath(addressNList);
              const network = getNetwork(coin, scriptType);

              let node = await Isolation.Adapters.BIP32.create(secp256k1MasterKey, network);
              if (hardenedPath.length > 0) node = await node.derivePath(core.addressNListToBIP32(hardenedPath));

              const xpub = node.neutered().toBase58();

              return { xpub };
            }
            case "ed25519": {
              const node = new Isolation.Adapters.Ed25519(ed25519MasterKey);
              const publicKey = await (async () => {
                if (!addressNList.length) return node.getPublicKey();
                return (await node.derivePath(core.addressNListToHardenedBIP32(addressNList))).getPublicKey();
              })();
              return { xpub: base58.encode(publicKey) };
            }
            default:
              throw new Error(`Unsupported curve: ${curve}`);
          }
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
    return this.needsMnemonic(!!this.#secp256k1MasterKey && !!this.#ed25519MasterKey, async () => {
      const secp256k1MasterKey = await this.#secp256k1MasterKey!;
      const ed25519MasterKey = await this.#ed25519MasterKey!;

      try {
        await Promise.all([
          super.btcInitializeWallet(secp256k1MasterKey),
          super.ethInitializeWallet(secp256k1MasterKey),
          super.cosmosInitializeWallet(secp256k1MasterKey),
          super.osmosisInitializeWallet(secp256k1MasterKey),
          super.binanceInitializeWallet(secp256k1MasterKey),
          super.thorchainInitializeWallet(secp256k1MasterKey),
          super.secretInitializeWallet(secp256k1MasterKey),
          super.terraInitializeWallet(secp256k1MasterKey),
          super.kavaInitializeWallet(secp256k1MasterKey),
          super.arkeoInitializeWallet(secp256k1MasterKey),
          super.solanaInitializeWallet(ed25519MasterKey),
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
    const oldSecp256k1MasterKey = this.#secp256k1MasterKey;
    const oldEd25519MasterKey = this.#ed25519MasterKey;

    this.#initialized = false;
    this.#secp256k1MasterKey = undefined;
    this.#ed25519MasterKey = undefined;

    super.solanaWipe();
    super.btcWipe();
    super.ethWipe();
    super.cosmosWipe();
    super.osmosisWipe();
    super.binanceWipe();
    super.thorchainWipe();
    super.secretWipe();
    super.terraWipe();
    super.kavaWipe();
    super.arkeoWipe();

    (await oldSecp256k1MasterKey)?.revoke?.();
    (await oldEd25519MasterKey)?.revoke?.();
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async reset(): Promise<void> {}

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async recover(): Promise<void> {}

  async loadDevice(msg?: LoadDevice): Promise<void> {
    this.#secp256k1MasterKey = Promise.resolve(
      await (async (mnemonic, secp256k1MasterKey) => {
        if (secp256k1MasterKey !== undefined) {
          return secp256k1MasterKey;
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
          const out = await seed.toSecp256k1MasterKey();
          out.addRevoker?.(() => seed.revoke?.());
          return out;
        }
        throw new Error("Either [mnemonic] or [secp256k1MasterKey] is required");
      })(msg?.mnemonic, msg?.secp256k1MasterKey)
    );

    this.#ed25519MasterKey = Promise.resolve(
      await (async (mnemonic, ed25519MasterKey) => {
        if (ed25519MasterKey !== undefined) {
          return ed25519MasterKey;
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
          const out = await seed.toEd25519MasterKey();
          out.addRevoker?.(() => seed.revoke?.());
          return out;
        }
        throw new Error("Either [mnemonic] or [ed25519MasterKey] is required");
      })(msg?.mnemonic, msg?.ed25519MasterKey)
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
