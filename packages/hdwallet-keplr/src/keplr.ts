import * as core from "@shapeshiftoss/hdwallet-core";
import * as cosmos from "./cosmos";
// import * as osmosis from "./osmosis";
import { caip2, ChainId, ChainReference } from "@shapeshiftoss/caip";
import { NetworkTypes } from "@shapeshiftoss/types";
import _ from "lodash";
import { Window as KeplrWindow } from "@keplr-wallet/types";
import { TxRaw } from "cosmjs-types/cosmos/tx/v1beta1/tx";

import { SigningCosmosClient } from "@cosmjs/launchpad";
import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";

import { SigningStargateClient } from "@cosmjs/stargate";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface Window extends KeplrWindow {}
}

/**
 * @description
 * @class KeplrTransport
 * @extends {core.Transport}
 */
class KeplrTransport extends core.Transport {
  /**
   * @description
   * @returns {*}
   * @memberof KeplrTransport
   */
  public async getDeviceID() {
    return "keplr:0";
  }

  /**
   * @description
   * @param {...any[]} args
   * @returns {*}  {Promise<any>}
   * @memberof KeplrTransport
   */
  public call(...args: any[]): Promise<any> {
    return Promise.resolve();
  }
}

export function isKeplr(wallet: core.HDWallet): wallet is KeplrHDWallet {
  return _.isObject(wallet) && (wallet as any)._isKeplr;
}

type HasNonTrivialConstructor<T> = T extends { new (): any } ? never : T;

/**
 * @description
 * @interface KeplrAddresses
 */
interface KeplrAddresses {
  [index: string]: string | null;
}

interface KeplrWalletState {
  addresses?: KeplrAddresses;
    address?: string;
    provider?: any;
    offlineSigner?: any;
    chainId?: string;

}

/**
 * @description
 * @export
 * @class KeplrHDWallet
 * @implements {core.HDWallet}
 * @implements {core.CosmosWallet}
 * @implements {core.OsmosisWallet}
 */
export class KeplrHDWallet implements core.HDWallet, core.CosmosWallet {
  readonly _isKeplr = true;
  readonly _supportsCosmos = true;
  readonly _supportsCosmosInfo = true;
  // readonly _supportsOsmosis = true;
  // readonly _supportsOsmosisInfo = true;

  transport: core.Transport = new KeplrTransport(new core.Keyring());
  info: KeplrHDWalletInfo & core.HDWalletInfo;

  state: KeplrWalletState = {};

  constructor() {
    this.info = new KeplrHDWalletInfo();
  }

  /**
   * @description
   * @returns {*}  {Promise<Record<string, any>>}
   * @memberof KeplrHDWallet
   */
  async getFeatures(): Promise<Record<string, any>> {
    return {};
  }

  /**
   * @description
   * @returns {*}  {Promise<boolean>}
   * @memberof KeplrHDWallet
   */
  public async isLocked(): Promise<boolean> {
    return this.state.provider.keplr.isLocked();
  }

  /**
   * @description
   * @returns {*}  {string}
   * @memberof KeplrHDWallet
   */
  public getVendor(): string {
    return "Keplr";
  }

  /**
   * @description
   * @returns {*}  {Promise<string>}
   * @memberof KeplrHDWallet
   */
  public getModel(): Promise<string> {
    return Promise.resolve("Keplr");
  }

  /**
   * @description
   * @returns {*}  {Promise<string>}
   * @memberof KeplrHDWallet
   */
  public getLabel(): Promise<string> {
    return Promise.resolve("Keplr");
  }

  /**
   * @description
   * @param {ChainId} [chainId="cosmos:cosmoshub-4"]
   * @returns {*}  {Promise<any>}
   * @memberof KeplrHDWallet
   */
  public async initialize(chainId: ChainId = "cosmos:cosmoshub-4"): Promise<any> {
    try {
      if (!window.keplr) {
        throw new Error("Keplr extension not installed.");
      }
      const assetData = caip2.fromCAIP2(chainId);

      /**
       * @todo: https://github.com/shapeshift/web/issues/1570 will break this code.
       * Replace NetworkTypes in switch/case with CAIP equivalent.
       */
      switch (assetData.network) {
        case NetworkTypes.COSMOSHUB_MAINNET || "" || undefined:
          this.state.chainId = NetworkTypes.COSMOSHUB_MAINNET;
          break;
        case NetworkTypes.COSMOSHUB_VEGA:
          this.state.chainId = NetworkTypes.COSMOSHUB_VEGA;
          break;
        // case NetworkTypes.OSMOSIS_MAINNET:
        //   this.chainId = NetworkTypes.OSMOSIS_MAINNET;
        //   break;
        // case NetworkTypes.OSMOSIS_TESTNET:
        //   this.chainId = NetworkTypes.OSMOSIS_TESTNET;
        //   break;
        default:
          throw new Error(`Unsupported chainId: ${chainId}`);
      }
      await window.keplr.enable(this.state.chainId);
      const offlineSigner = window.keplr.getOfflineSigner(this.state.chainId);
      this.state.address = (await offlineSigner.getAccounts())[0].address;
      // this.state.addresses.[this.state.chainId] = (await offlineSigner.getAccounts())[0].address;
      this.state.provider = window.keplr;

      return Promise.resolve();
    } catch (error) {
      /**
       * @todo Use logger instead of console.error()
       */
      console.error("Error initializing Keplr", error);
    }
  }

  public hasOnDevicePinEntry(): boolean {
    return this.info.hasOnDevicePinEntry();
  }

  public hasOnDevicePassphrase(): boolean {
    return this.info.hasOnDevicePassphrase();
  }

  public hasOnDeviceDisplay(): boolean {
    return this.info.hasOnDeviceDisplay();
  }

  public hasOnDeviceRecovery(): boolean {
    return this.info.hasOnDeviceRecovery();
  }

  public hasNativeShapeShift(srcCoin: core.Coin, dstCoin: core.Coin): boolean {
    return this.info.hasNativeShapeShift(srcCoin, dstCoin);
  }

  public supportsOfflineSigning(): boolean {
    return true;
  }

  public supportsBroadcast(): boolean {
    return true;
  }

  public async clearSession(): Promise<void> {
    // TODO: Can we lock Keplr from here?
  }

  public ping(msg: core.Ping): Promise<core.Pong> {
    // no ping function for Keplr, so just returning Core.Pong
    return Promise.resolve({ msg: msg.msg });
  }

  public sendPin(pin: string): Promise<void> {
    // no concept of pin in Keplr
    return Promise.resolve();
  }

  public sendPassphrase(passphrase: string): Promise<void> {
    // cannot send passphrase to Keplr. Could show the widget?
    return Promise.resolve();
  }

  public sendCharacter(charater: string): Promise<void> {
    // no concept of sendCharacter in Keplr
    return Promise.resolve();
  }

  public sendWord(word: string): Promise<void> {
    // no concept of sendWord in Keplr
    return Promise.resolve();
  }

  public cancel(): Promise<void> {
    // no concept of cancel in Keplr
    return Promise.resolve();
  }

  public wipe(): Promise<void> {
    return Promise.resolve();
  }

  public reset(msg: core.ResetDevice): Promise<void> {
    return Promise.resolve();
  }

  public recover(msg: core.RecoverDevice): Promise<void> {
    // no concept of recover in Keplr
    return Promise.resolve();
  }

  public loadDevice(msg: core.LoadDevice): Promise<void> {
    // TODO: Does Keplr allow this to be done programatically?
    return Promise.resolve();
  }

  public describePath(msg: core.DescribePath): core.PathDescription {
    return this.info.describePath(msg);
  }

  public async getPublicKeys(msg: Array<core.GetPublicKey>): Promise<Array<core.PublicKey | null>> {
    const keys: Array<core.PublicKey | null> = [];
    await this.state.provider.keplr.enable(this.state.chainId);
    const offlineSigner = this.state.provider.keplr.getOfflineSigner(this.state.chainId);
    keys.push({ xpub: Buffer.from((await offlineSigner.getAccounts())[0].pubkey).toString() });
    return keys;
  }

  public async isInitialized(): Promise<boolean> {
    if (!this.state.provider.keplr) {
      return false;
    }
    return true;
  }

  public disconnect(): Promise<void> {
    return Promise.resolve();
  }

  public async cosmosSupportsNetwork(chainId: number = 118): Promise<boolean> {
    return chainId === 118;
  }

  public async cosmosSupportsSecureTransfer(): Promise<boolean> {
    return false;
  }

  public cosmosSupportsNativeShapeShift(): boolean {
    return false;
  }

  public cosmosGetAccountPaths(msg: core.CosmosGetAccountPaths): Array<core.CosmosAccountPath> {
    return cosmos.cosmosGetAccountPaths(msg);
  }

  public cosmosNextAccountPath(msg: core.CosmosAccountPath): core.CosmosAccountPath | undefined {
    return this.info.cosmosNextAccountPath(msg);
  }

  /**
   * @description
   * @param {core.CosmosGetAddress} msg
   * @returns {*}  {(Promise<string | null>)}
   * @memberof KeplrHDWallet
   */
  public async cosmosGetAddress(msg: core.CosmosGetAddress): Promise<string | null> {
    const address = await cosmos.cosmosGetAddress(this.state.provider);
    if(address){
      this.state.address = address;
    return address;

    }
    return null;

  }

  public async cosmosSignTx(msg: core.CosmosSignTx): Promise<core.CosmosSignedTx | null> {
    return cosmos.cosmosSignTx(msg, this.state);
    // const address = await this.cosmosGetAddress(this.provider);
    // return address ? cosmos.cosmosSignTx(msg, this.provider, address) : null;
  }

  public async cosmosSendTx(msg: core.CosmosSignTx): Promise<string | null> {
    const address = await this.cosmosGetAddress(this.state.provider);
    return address ? cosmos.cosmosSendTx(msg, this.state) : null;
  }

  // public async cosmosSignMessage(msg: core.CosmosSignMessage): Promise<core.CosmosSignedMessage | null> {
  //   const address = await this.cosmosGetAddress(this.provider);
  //   return address ? cosmos.cosmosSignMessage(msg, this.provider, address) : null;
  // }

  // public async osmosisSupportsNetwork(chainId: number = 118): Promise<boolean> {
  //   return chainId === 118;
  // }

  // public async osmosisSupportsSecureTransfer(): Promise<boolean> {
  //   return false;
  // }

  // public osmosisSupportsNativeShapeShift(): boolean {
  //   return false;
  // }

  // public osmosisGetAccountPaths(msg: core.OsmosisGetAccountPaths): Array<core.OsmosisAccountPath> {
  //   return osmosis.osmosisGetAccountPaths(msg);
  // }

  // public osmosisNextAccountPath(msg: core.OsmosisAccountPath): core.OsmosisAccountPath | undefined {
  //   return this.info.osmosisNextAccountPath(msg);
  // }

  // public async osmosisGetAddress(msg: core.OsmosisAddress): Promise<string | null> {
  //   if (this.addresses[ChainReference.OsmosisMainnet]) {
  //     return this.addresses[ChainReference.OsmosisMainnet];
  //   }
  //   const address = await osmosis.osmosisGetAddress(this.provider);
  //   if (address) {
  //     this.addresses[ChainReference.OsmosisMainnet] = address;
  //     return address;
  //   } else {
  //     this.addresses[ChainReference.OsmosisMainnet] = null;
  //     return null;
  //   }
  // }

  // public async osmosisSignTx(msg: core.OsmosisSignTx): Promise<core.OsmosisSignedTx | null> {
  //   const address = await this.osmosisGetAddress(this.provider);
  //   return address ? osmosis.osmosisSignTx(msg, this.provider, address) : null;
  // }

  // public async osmosisSendTx(msg: core.OsmosisSignTx): Promise<core.OsmosisTxHash | null> {
  //   const address = await this.osmosisGetAddress(this.provider);
  //   return address ? osmosis.osmosisSendTx(msg, this.provider, address) : null;
  // }

  // public async osmosisSignMessage(msg: core.OsmosisSignMessage): Promise<core.OsmosisSignedMessage | null> {
  //   const address = await this.osmosisGetAddress(this.provider);
  //   return address ? osmosis.osmosisSignMessage(msg, this.provider, address) : null;
  // }

  public async getDeviceID(): Promise<string> {
    return "metaMask:" + (await this.cosmosGetAddress(this.state.provider));
  }

  public async getFirmwareVersion(): Promise<string> {
    return "metaMask";
  }
}

/**
 * @description
 * @export
 * @class KeplrHDWalletInfo
 * @implements {core.HDWalletInfo}
 * @implements {core.CosmosWalletInfo}
 * @implements {core.OsmosisWalletInfo}
 */
export class KeplrHDWalletInfo implements core.HDWalletInfo, core.CosmosWalletInfo {
  readonly _supportsCosmosInfo = true;
  readonly _supportsOsmosisInfo = true;

  public getVendor(): string {
    return "Keplr";
  }

  public hasOnDevicePinEntry(): boolean {
    return false;
  }

  public hasOnDevicePassphrase(): boolean {
    return true;
  }

  public hasOnDeviceDisplay(): boolean {
    return true;
  }

  public hasOnDeviceRecovery(): boolean {
    return true;
  }

  public hasNativeShapeShift(srcCoin: core.Coin, dstCoin: core.Coin): boolean {
    return false;
  }

  public supportsOfflineSigning(): boolean {
    return true;
  }

  public supportsBroadcast(): boolean {
    return true;
  }

  public describePath(msg: core.DescribePath): core.PathDescription {
    switch (msg.coin) {
      case "Atom":
        return cosmos.cosmosDescribePath(msg.path);
      default:
        throw new Error("Unsupported path");
    }
  }

  public async cosmosSupportsNetwork(chainId: number = 1): Promise<boolean> {
    return chainId === 1;
  }

  public async cosmosSupportsSecureTransfer(): Promise<boolean> {
    return false;
  }

  public cosmosSupportsNativeShapeShift(): boolean {
    return false;
  }

  public cosmosGetAccountPaths(msg: core.CosmosGetAccountPaths): Array<core.CosmosAccountPath> {
    return cosmos.cosmosGetAccountPaths(msg);
  }

  public cosmosNextAccountPath(msg: core.CosmosAccountPath): core.CosmosAccountPath | undefined {
    // TODO: What do we do here?
    return undefined;
  }

  // public osmosisGetAccountPaths(msg: core.OsmosisGetAccountPaths): Array<core.OsmosisAccountPath> {
  //   return osmosis.osmosisGetAccountPaths(msg);
  // }

  // public osmosisNextAccountPath(msg: core.OsmosisAccountPath): core.OsmosisAccountPath | undefined {
  //   return undefined;
  // }
}

export function info() {
  return new KeplrHDWalletInfo();
}

export function create(): KeplrHDWallet {
  return new KeplrHDWallet();
}
