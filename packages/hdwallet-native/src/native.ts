import * as core from "@shapeshiftoss/hdwallet-core";
import * as bip39 from "bip39";
import * as bip32 from "bip32";
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
import * as Isolation from "./crypto/isolation";

export enum NativeEvents {
  MNEMONIC_REQUIRED = "MNEMONIC_REQUIRED",
  READY = "READY",
}

function isMnemonicInterface(x: any): x is Isolation.Core.BIP39.Mnemonic {
  return ["object", "function"].includes(typeof x) && x !== null && "toSeed" in x && typeof x.toSeed === "function";
}

type LoadDevice = Omit<core.LoadDevice, "mnemonic"> & {
  // Set this if your deviceId is dependent on the mnemonic
  deviceId?: string;
} & ({
  mnemonic: string | Isolation.Core.BIP39.Mnemonic;
  masterKey?: never
} | {
  mnemonic?: never;
  masterKey: Isolation.Core.BIP32.Node;
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
  #masterKey: Promise<Isolation.Core.BIP32.Node> | undefined = undefined;

  constructor({ mnemonic, deviceId, masterKey }: NativeAdapterArgs) {
    super();
    if (masterKey) {
      this.#masterKey = Promise.resolve(masterKey);
    } else if (mnemonic) {
      this.#masterKey = (async () => {
        const isolatedMnemonic = typeof mnemonic === "string" ? await Isolation.Engines.Default.BIP39.Mnemonic.create(mnemonic) : mnemonic
        const seed = await isolatedMnemonic.toSeed();
        return await seed.toMasterKey();
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

  async getAddress(msg: core.GetAddress): Promise<string> {
    switch (msg.blockchain.toLowerCase()) {
      case "bitcoin":
      case "bitcoincash":
      case "dash":
      case "digibyte":
      case "dogecoin":
      case "litecoin":
      case "testnet":
        let inputClone: core.BTCAccountPath = {
          addressNList: msg.path,
          coin: msg.blockchain,
          scriptType: msg.scriptType,
        };
        // @ts-ignore
        return super.btcGetAddress(inputClone);
      case "ethereum":
        let inputETH: core.BTCAccountPath = {
          addressNList: msg.path,
          coin: msg.blockchain,
          scriptType: msg.scriptType,
        };
        // @ts-ignore
        return super.ethGetAddress(inputETH);
      case "fio":
        let inputFIO: core.FioAccountPath = {
          addressNList: msg.path,
        };
        // @ts-ignore
        return super.fioGetAddress(inputFIO);
      // case "eos":
      //   let inputEOS: core.EosAccountPath = {
      //     addressNList: msg.path,
      //   };
      //   return super.eosGetAddress(inputEOS);
      case "osmosis":
        let inputOSMO: core.OsmosisGetAddress = {
          addressNList: msg.path,
        };
        // @ts-ignore
        return super.osmosisGetAddress(inputOSMO);
      case "cosmos":
        let inputATOM: core.CosmosGetAddress = {
          addressNList: msg.path,
        };
        // @ts-ignore
        return super.cosmosGetAddress(inputATOM);
      case "thorchain":
        let inputRUNE: core.ThorchainGetAddress = {
          addressNList: msg.path,
        };
        // @ts-ignore
        return super.thorchainGetAddress(inputRUNE);
      case "binance":
        let inputBNB: core.BinanceAccountPath = {
          addressNList: msg.path,
        };
        // @ts-ignore
        return super.binanceGetAddress(inputBNB);
      default:
        throw new Error("Unsupported path " + msg.blockchain);
    }
  }

  /*
   * @see: https://github.com/satoshilabs/slips/blob/master/slip-0132.md
   * to supports different styles of xpubs as can be defined by passing in a network to `fromSeed`
   */
  async getPublicKeys(msg: Array<core.GetPublicKey>): Promise<core.PublicKey[] | null> {
    return this.needsMnemonic(!!this.#mnemonic, async () =>
      Promise.all(
        msg.map(async (getPublicKey) => {
          let { addressNList, addressNListMaster } = getPublicKey;
          if(!this.#mnemonic) throw Error("Not initialized")
          const seed = await bip39.mnemonicToSeed(String(this.#mnemonic));

          const network = getNetwork("bitcoin", getPublicKey.scriptType);
          const node = bip32.fromSeed(seed, network);
          const xpub = node.derivePath(core.addressNListToBIP32(addressNList)).neutered().toBase58();

          let addressInfo: any = {
            path: addressNListMaster,
            blockchain: getPublicKey.blockchain.toLowerCase(),
            scriptType: getPublicKey.script_type,
          };

          let pubkey: any = {
            coin: getPublicKey.network,
            blockchain:getPublicKey.blockchain,
            network: getPublicKey.network,
            script_type: getPublicKey.script_type,
            path: core.addressNListToBIP32(addressNList),
            pathMaster: core.addressNListToBIP32(addressNListMaster),
            long: getPublicKey.blockchain,
            address: await this.getAddress(addressInfo),
            master: await this.getAddress(addressInfo),
            type: getPublicKey.type,
          };
          //TODO
          if(this.#isTestnet){
            //pubkey.tpub = await crypto.xpubConvert(xpub,'tpub')
          }else{
            pubkey.xpub = xpub
          }

          switch(getPublicKey.type) {
            case "address":
              pubkey.pubkey = pubkey.address;
              break;
            case 'xpub':
              pubkey.pubkey = pubkey.xpub
              break;
            case 'tpub':
              pubkey.pubkey = pubkey.tpub
              break;
            case 'zpub':
              // let root = new BIP84.fromSeed(this.#mnemonic)
              // let child0 = root.deriveAccount(0)
              // let account0 = new BIP84.fromZPrv(child0)
              // let zpub = account0.getAccountPublicKey()
              // pubkey.address = account0.getAddress(0)
              // pubkey.master = account0.getAddress(0)
              // pubkey.zpub = zpub
              pubkey.address = "foobar"
              pubkey.master = "foobar"
              pubkey.zpub = "foobar"
              pubkey.pubkey = pubkey.zpub
              break;
            default:
              throw Error("Unhandled pubkey type! :"+getPublicKey.type)
          }

          return pubkey;
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
  }

  async reset(): Promise<void> {}

  async recover(): Promise<void> {}

  async loadDevice(msg?: LoadDevice): Promise<void> {
    this.#masterKey = Promise.resolve(await (async (mnemonic, masterKey) => {
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
        return await seed.toMasterKey();
      }
      throw new Error("Either [mnemonic] or [masterKey] is required");
    })(msg?.mnemonic, msg?.masterKey));

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
