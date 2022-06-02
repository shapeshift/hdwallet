import { Window as KeplrWindow } from "@keplr-wallet/types";
import { ChainReference } from "@shapeshiftoss/caip";
import * as core from "@shapeshiftoss/hdwallet-core";
import isObject from "lodash/isObject";

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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public call(...args: any[]): Promise<void> {
    return Promise.resolve();
  }
}

export function isKeplr(wallet: core.HDWallet): wallet is KeplrHDWallet {
  return isObject(wallet) && (wallet as any)._isKeplr;
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
    return false;
  }

  public hasOnDeviceDisplay(): boolean {
    return true;
  }

  public hasOnDeviceRecovery(): boolean {
    return false;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

  initialized = false;
  provider: any = {};
  supportedNetworks: ChainReference[] = [ChainReference.CosmosHubMainnet, ChainReference.OsmosisMainnet];

  constructor() {
    this.info = new KeplrHDWalletInfo();
  }

  async getFeatures(): Promise<Record<string, any>> {
    return {};
  }

  public async isLocked(): Promise<boolean> {
    return this.provider.isLocked();
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

  public async initialize(networks: Array<ChainReference> = []): Promise<void> {
    try {
      if (!window.keplr) {
        throw new Error("Keplr extension not installed.");
      }
      this.provider = window.keplr;

      /** Initialize Keplr Wallet with all supported chains by default
       * or the subset of supported chains passed in the call to initialize() */
      await this.provider.enable(networks.length ? networks : this.supportedNetworks);
      return Promise.resolve();
    } catch (error) {
      /**
       * @todo Use logger instead of console.error()
       */
      console.error(error);
      throw new Error("Error initializing Keplr");
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public sendPin(pin: string): Promise<void> {
    // no concept of pin in Keplr
    return Promise.resolve();
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public sendPassphrase(passphrase: string): Promise<void> {
    // cannot send passphrase to Keplr. Could show the widget?
    return Promise.resolve();
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public sendCharacter(character: string): Promise<void> {
    // no concept of sendCharacter in Keplr
    return Promise.resolve();
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public reset(msg: core.ResetDevice): Promise<void> {
    return Promise.resolve();
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public recover(msg: core.RecoverDevice): Promise<void> {
    // no concept of recover in Keplr
    return Promise.resolve();
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public loadDevice(msg: core.LoadDevice): Promise<void> {
    /**
     * @todo: Does Keplr allow this to be done programatically?
     */
    return Promise.resolve();
  }

  public describePath(msg: core.DescribePath): core.PathDescription {
    return this.info.describePath(msg);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async getPublicKeys(
    msg: Array<core.GetPublicKey>,
    chainId: ChainReference = ChainReference.CosmosHubMainnet
  ): Promise<Array<core.PublicKey | null>> {
    if (!this.supportedNetworks.includes(chainId)) {
      throw new Error(`Unsupported chainId: ${chainId}`);
    }
    const keys: Array<core.PublicKey | null> = [];
    await this.provider.enable(chainId);
    const offlineSigner = this.provider.getOfflineSigner(chainId);
    keys.push({ xpub: Buffer.from((await offlineSigner.getAccounts())[0].pubkey).toString() });
    return keys;
  }

  public async isInitialized(): Promise<boolean> {
    return this.initialized;
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async cosmosGetAddress(): Promise<string | null> {
    return (await cosmos.cosmosGetAddress(this.provider)) || null;
  }

  public async cosmosSignTx(msg: core.CosmosSignTx): Promise<core.CosmosSignedTx | null> {
    return cosmos.cosmosSignTx(this.provider, msg);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async osmosisGetAddress(): Promise<string | null> {
    return (await osmosis.osmosisGetAddress(this.provider)) || null;
  }

  public async osmosisSignTx(msg: core.OsmosisSignTx): Promise<core.OsmosisSignedTx | null> {
    return osmosis.osmosisSignTx(this.provider, msg);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async osmosisSendTx(msg: core.OsmosisSignTx): Promise<string | null> {
    /** Broadcast from Keplr is currently unimplemented */
    return null;
  }

  public async getDeviceID(): Promise<string> {
    return "keplr:" + (await this.cosmosGetAddress());
  }

  public async getFirmwareVersion(): Promise<string> {
    return "keplr";
  }
}
