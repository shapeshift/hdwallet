import * as core from "@shapeshiftoss/hdwallet-core";
import * as cosmos from "./cosmos";
import _ from "lodash";
import detectEthereumProvider from "@metamask/detect-provider";
import { Window as KeplrWindow } from '@keplr-wallet/types'

declare global {
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface Window extends KeplrWindow {}
}

class KeplrTransport extends core.Transport {
  public async getDeviceID() {
    return "metamask:0";
  }

  public call(...args: any[]): Promise<any> {
    return Promise.resolve();
  }
}

export function isKeplr(wallet: core.HDWallet): wallet is KeplrHDWallet {
  return _.isObject(wallet) && (wallet as any)._isKeplr;
}

type HasNonTrivialConstructor<T> = T extends { new (): any } ? never : T;

export class KeplrHDWallet implements core.HDWallet, core.CosmosWallet {
  readonly _supportsETH = true;
  readonly _supportsETHInfo = true;
  readonly _supportsBTCInfo = false;
  readonly _supportsBTC = false;
  readonly _supportsCosmosInfo = false;
  readonly _supportsCosmos = false;
  readonly _supportsOsmosisInfo = false;
  readonly _supportsOsmosis = false;
  readonly _supportsBinanceInfo = false;
  readonly _supportsBinance = false;
  readonly _supportsDebugLink = false;
  readonly _isPortis = false;
  readonly _isKeplr = true;
  readonly _supportsRippleInfo = false;
  readonly _supportsRipple = false;
  readonly _supportsEosInfo = false;
  readonly _supportsEos = false;
  readonly _supportsFioInfo = false;
  readonly _supportsFio = false;
  readonly _supportsThorchainInfo = false;
  readonly _supportsThorchain = false;
  readonly _supportsSecretInfo = false;
  readonly _supportsSecret = false;
  readonly _supportsKava = false;
  readonly _supportsKavaInfo = false;
  readonly _supportsTerra = false;
  readonly _supportsTerraInfo = false;

  transport: core.Transport = new KeplrTransport(new core.Keyring());
  info: KeplrHDWalletInfo & core.HDWalletInfo;
  cosmosAddress?: string | null;
  provider: any;

  constructor() {
    this.info = new KeplrHDWalletInfo();
  }

  async getFeatures(): Promise<Record<string, any>> {
    return {};
  }

  public async isLocked(): Promise<boolean> {
    return !this.provider.metamask.isUnlocked();
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

  public async initialize(): Promise<any> {
      if(!window.keplr){
        throw new Error("Keplr extension not installed.")
      }
      const chainId = "cosmoshub-4";
      await window.keplr.enable(chainId);
      const offlineSigner = window.keplr.getOfflineSigner(chainId);
      this.cosmosAddress = (await offlineSigner.getAccounts())[0].address;
      this.provider = window.keplr

    return Promise.resolve();
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
    return false;
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
    // Ethereum public keys are not exposed by the RPC API
    return [];
  }

  public async isInitialized(): Promise<boolean> {
    if(!window.keplr){
      return false;
    }
    return true;
  }

  public disconnect(): Promise<void> {
    return Promise.resolve();
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
    return this.info.cosmosNextAccountPath(msg);
  }

  public async cosmosGetAddress(msg: core.CosmosGetAddress): Promise<string | null> {
    if (this.cosmosAddress) {
      return this.cosmosAddress;
    }
    const address = await cosmos.cosmosGetAddress(this.provider);
    if (address) {
      this.cosmosAddress = address;
      return address;
    } else {
      this.cosmosAddress = null;
      return null;
    }
  }

  public async cosmosSignTx(msg: core.CosmosSignTx): Promise<core.CosmosSignedTx | null> {
    const address = await this.cosmosGetAddress(this.provider);
    return address ? cosmos.cosmosSignTx(msg, this.provider, address) : null;
  }

  public async cosmosSendTx(msg: core.CosmosSignTx): Promise<core.CosmosTxHash | null> {
    const address = await this.cosmosGetAddress(this.provider);
    return address ? cosmos.cosmosSendTx(msg, this.provider, address) : null;
  }

  public async cosmosSignMessage(msg: core.CosmosSignMessage): Promise<core.CosmosSignedMessage | null> {
    const address = await this.cosmosGetAddress(this.provider);
    return address ? cosmos.cosmosSignMessage(msg, this.provider, address) : null;
  }

  public async getDeviceID(): Promise<string> {
    return "metaMask:" + (await this.cosmosGetAddress(this.provider));
  }

  public async getFirmwareVersion(): Promise<string> {
    return "metaMask";
  }
}

export class KeplrHDWalletInfo implements core.HDWalletInfo, core.CosmosWalletInfo {
  readonly _supportsBTCInfo = false;
  readonly _supportsETHInfo = false;
  readonly _supportsCosmosInfo = true;
  readonly _supportsBinanceInfo = false;
  readonly _supportsRippleInfo = false;
  readonly _supportsEosInfo = false;
  readonly _supportsFioInfo = false;
  readonly _supportsThorchainInfo = false;
  readonly _supportsSecretInfo = false;
  readonly _supportsKavaInfo = false;
  readonly _supportsTerraInfo = false;

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
    // It doesn't... yet?
    return false;
  }

  public supportsOfflineSigning(): boolean {
    return true;
  }

  public supportsBroadcast(): boolean {
    return true;
  }

  public cosmosNextAccountPath(msg: core.CosmosAccountPath): core.CosmosAccountPath | undefined {
    // TODO: What do we do here?
    return undefined;
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
}

export function info() {
  return new KeplrHDWalletInfo();
}

export function create(): KeplrHDWallet {
  return new KeplrHDWallet();
}
