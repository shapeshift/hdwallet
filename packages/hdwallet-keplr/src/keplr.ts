import { Window as KeplrWindow } from "@keplr-wallet/types";
import { ChainId, ChainReference, fromChainId, networkTypeToChainReference } from "@shapeshiftoss/caip";
import * as core from "@shapeshiftoss/hdwallet-core";
import _ from "lodash";

import * as cosmos from "./cosmos";
import * as osmosis from "./osmosis";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface Window extends KeplrWindow {}
}

class KeplrTransport extends core.Transport {
  public async getDeviceID() {
    return "keplr:0";
  }

  public call(...args: any[]): Promise<any> {
    return Promise.resolve();
  }
}

export function isKeplr(wallet: core.HDWallet): wallet is KeplrHDWallet {
  return _.isObject(wallet) && (wallet as any)._isKeplr;
}

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

export class KeplrHDWalletInfo implements core.HDWalletInfo, core.CosmosWalletInfo, core.OsmosisWalletInfo {
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
      case "Osmo":
        return osmosis.osmosisDescribePath(msg.path);
      default:
        throw new Error("Unsupported path");
    }
  }

  public async cosmosSupportsNetwork(chainId = 1): Promise<boolean> {
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

  public async osmosisSupportsNetwork(chainId = 1): Promise<boolean> {
    return chainId === 1;
  }

  public async osmosisSupportsSecureTransfer(): Promise<boolean> {
    return false;
  }

  public osmosisSupportsNativeShapeShift(): boolean {
    return false;
  }

  public osmosisGetAccountPaths(msg: core.OsmosisGetAccountPaths): Array<core.OsmosisAccountPath> {
    return osmosis.osmosisGetAccountPaths(msg);
  }

  public osmosisNextAccountPath(msg: core.OsmosisAccountPath): core.OsmosisAccountPath | undefined {
    return undefined;
  }
}

export class KeplrHDWallet implements core.HDWallet, core.CosmosWallet, core.OsmosisWallet {
  readonly _isKeplr = true;
  readonly _supportsCosmos = true;
  readonly _supportsCosmosInfo = true;
  readonly _supportsOsmosis = true;
  readonly _supportsOsmosisInfo = true;

  transport: core.Transport = new KeplrTransport(new core.Keyring());
  info: KeplrHDWalletInfo & core.HDWalletInfo;

  state: KeplrWalletState = {};
  supportedNetworks: ChainReference[] = [
    ChainReference.CosmosHubMainnet,
    ChainReference.CosmosHubVega,
    ChainReference.OsmosisMainnet,
    ChainReference.OsmosisTestnet,
  ];

  constructor() {
    this.info = new KeplrHDWalletInfo();
  }

  async getFeatures(): Promise<Record<string, any>> {
    return {};
  }

  public async isLocked(): Promise<boolean> {
    return this.state.provider.isLocked();
  }

  public getVendor(): string {
    return "Keplr";
  }

  public getModel(): Promise<string> {
    return Promise.resolve("Keplr");
  }

  public getLabel(): Promise<string> {
    return Promise.resolve("Keplr");
  }

  public async initialize(chainId: ChainId = ""): Promise<any> {
    try {
      if (!window.keplr) {
        throw new Error("Keplr extension not installed.");
      }
      if (!chainId) {
        throw new Error("Please specify CAIP2-compliant chainId in call to initialize()");
      }
      const network = networkTypeToChainReference[fromChainId(chainId).network];
      if (this.supportedNetworks.includes(network)) {
        this.state.chainId = network;
      } else {
        throw new Error(`Unsupported chainId: ${chainId}`);
      }

      await window.keplr.enable(this.state.chainId);
      const offlineSigner = window.keplr.getOfflineSigner(this.state.chainId);
      this.state.address = (await offlineSigner.getAccounts())[0].address;
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
    /**
     * @todo: Does Keplr allow this to be done programatically?
     */
    return Promise.resolve();
  }

  public describePath(msg: core.DescribePath): core.PathDescription {
    return this.info.describePath(msg);
  }

  public async getPublicKeys(msg: Array<core.GetPublicKey>): Promise<Array<core.PublicKey | null>> {
    const keys: Array<core.PublicKey | null> = [];
    await this.state.provider.enable(this.state.chainId);
    const offlineSigner = this.state.provider.getOfflineSigner(this.state.chainId);
    keys.push({ xpub: Buffer.from((await offlineSigner.getAccounts())[0].pubkey).toString() });
    return keys;
  }

  public async isInitialized(): Promise<boolean> {
    if (!this.state.provider) {
      return false;
    }
    return true;
  }

  public disconnect(): Promise<void> {
    return Promise.resolve();
  }

  public async cosmosSupportsNetwork(chainId = 118): Promise<boolean> {
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

  public async cosmosGetAddress(msg: core.CosmosGetAddress): Promise<string | null> {
    if (this.state.chainId != (ChainReference.CosmosHubMainnet || ChainReference.CosmosHubVega)) {
      throw new Error("Please change network to 'Cosmos.'");
    }
    const address = await cosmos.cosmosGetAddress(this.state);
    if (address) {
      this.state.address = address;
      return address;
    }
    return null;
  }

  public async cosmosSignTx(msg: core.CosmosSignTx): Promise<core.CosmosSignedTx | null> {
    if (this.state.chainId != (ChainReference.CosmosHubMainnet || ChainReference.CosmosHubVega)) {
      throw new Error("Please change network to 'Cosmos.'");
    }
    return cosmos.cosmosSignTx(msg, this.state);
  }

  public async cosmosSendTx(msg: core.CosmosSignTx): Promise<string | null> {
    /** Broadcast from Keplr is currently unimplemented */
    return null;
  }

  public async osmosisSupportsNetwork(chainId = 118): Promise<boolean> {
    return chainId === 118;
  }

  public async osmosisSupportsSecureTransfer(): Promise<boolean> {
    return false;
  }

  public osmosisSupportsNativeShapeShift(): boolean {
    return false;
  }

  public osmosisGetAccountPaths(msg: core.OsmosisGetAccountPaths): Array<core.OsmosisAccountPath> {
    return osmosis.osmosisGetAccountPaths(msg);
  }

  public osmosisNextAccountPath(msg: core.OsmosisAccountPath): core.OsmosisAccountPath | undefined {
    return this.info.osmosisNextAccountPath(msg);
  }

  public async osmosisGetAddress(msg: core.OsmosisGetAddress): Promise<string | null> {
    if (this.state.chainId != (ChainReference.OsmosisMainnet || ChainReference.OsmosisTestnet)) {
      throw new Error("Please change network to 'Osmosis.'");
    }
    const address = await osmosis.osmosisGetAddress(this.state);
    if (address) {
      this.state.address = address;
      return address;
    }
    return null;
  }

  public async osmosisSignTx(msg: core.OsmosisSignTx): Promise<core.OsmosisSignedTx | null> {
    if (this.state.chainId != (ChainReference.OsmosisMainnet || ChainReference.OsmosisTestnet)) {
      throw new Error("Please change network to 'Osmosis.'");
    }
    return osmosis.osmosisSignTx(msg, this.state);
  }

  public async osmosisSendTx(msg: core.OsmosisSignTx): Promise<string | null> {
    /** Broadcast from Keplr is currently unimplemented */
    return null;
  }

  public async getDeviceID(): Promise<string> {
    return "keplr:" + (await this.cosmosGetAddress(this.state.provider));
  }

  public async getFirmwareVersion(): Promise<string> {
    return "keplr";
  }
}
