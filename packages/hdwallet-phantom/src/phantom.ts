import * as core from "@shapeshiftoss/hdwallet-core";
import { AddEthereumChainParameter } from "@shapeshiftoss/hdwallet-core";
import { ethErrors, serializeError } from "eth-rpc-errors";
import _ from "lodash";

import * as eth from "./ethereum";

export function isPhantom(wallet: core.HDWallet): wallet is PhantomHDWallet {
  return _.isObject(wallet) && (wallet as any)._isPhantom;
}

export class PhantomHDWalletInfo implements core.HDWalletInfo, core.ETHWalletInfo {
  readonly _supportsBTCInfo = false;
  readonly _supportsETHInfo = true;
  readonly _supportsCosmosInfo = false;
  readonly _supportsBinanceInfo = false;
  readonly _supportsRippleInfo = false;
  readonly _supportsEosInfo = false;
  readonly _supportsFioInfo = false;
  readonly _supportsThorchainInfo = false;
  readonly _supportsSecretInfo = false;
  readonly _supportsKavaInfo = false;
  readonly _supportsTerraInfo = false;

  public getVendor(): string {
    return "Phantom";
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public hasNativeShapeShift(srcCoin: core.Coin, dstCoin: core.Coin): boolean {
    return false;
  }

  public supportsBip44Accounts(): boolean {
    return false;
  }

  public supportsOfflineSigning(): boolean {
    return false;
  }

  public supportsBroadcast(): boolean {
    return true;
  }

  public describePath(msg: core.DescribePath): core.PathDescription {
    switch (msg.coin) {
      case "Ethereum":
        return eth.describeETHPath(msg.path);
      default:
        throw new Error("Unsupported path");
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public ethNextAccountPath(msg: core.ETHAccountPath): core.ETHAccountPath | undefined {
    // TODO: What do we do here?
    return undefined;
  }

  public async ethSupportsNetwork(chainId: number): Promise<boolean> {
    return chainId === 1;
  }

  public async ethSupportsSecureTransfer(): Promise<boolean> {
    return false;
  }

  public ethSupportsNativeShapeShift(): boolean {
    return false;
  }

  public async ethSupportsEIP1559(): Promise<boolean> {
    return true;
  }

  public ethGetAccountPaths(msg: core.ETHGetAccountPath): Array<core.ETHAccountPath> {
    return eth.ethGetAccountPaths(msg);
  }
}

export class PhantomHDWallet implements core.HDWallet, core.ETHWallet {
  readonly _supportsETH = true;
  readonly _supportsETHInfo = true;
  readonly _supportsBTCInfo = false;
  readonly _supportsBTC = true;
  readonly _supportsCosmosInfo = false;
  readonly _supportsCosmos = false;
  readonly _supportsEthSwitchChain = false;
  readonly _supportsAvalanche = false;
  readonly _supportsOptimism = false;
  readonly _supportsBSC = false;
  readonly _supportsPolygon = true;
  readonly _supportsGnosis = false;
  readonly _supportsArbitrum = false;
  readonly _supportsArbitrumNova = false;
  readonly _supportsBase = false;
  readonly _supportsOsmosisInfo = false;
  readonly _supportsOsmosis = false;
  readonly _supportsBinanceInfo = false;
  readonly _supportsBinance = false;
  readonly _supportsDebugLink = false;
  readonly _isPortis = false;
  readonly _isPhantom = true;
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

  info: PhantomHDWalletInfo & core.HDWalletInfo;
  ethAddress?: string | null;
  provider: any;

  constructor(provider: unknown) {
    this.info = new PhantomHDWalletInfo();
    this.provider = provider;
  }

  async getFeatures(): Promise<Record<string, any>> {
    return {};
  }

  public async isLocked(): Promise<boolean> {
    return !this.provider._phantom.isUnlocked();
  }

  public getVendor(): string {
    return "Phantom";
  }

  public async getModel(): Promise<string> {
    return "Phantom";
  }

  public async getLabel(): Promise<string> {
    return "Phantom";
  }

  public async initialize(): Promise<void> {
    // nothing to initialize
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

  public supportsBip44Accounts(): boolean {
    return this.info.supportsBip44Accounts();
  }

  public supportsOfflineSigning(): boolean {
    return false;
  }

  public supportsBroadcast(): boolean {
    return true;
  }

  public async clearSession(): Promise<void> {
    // TODO: Can we lock Phantom from here?
  }

  public async ping(msg: core.Ping): Promise<core.Pong> {
    // no ping function for Phantom, so just returning Core.Pong
    return { msg: msg.msg };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async sendPin(pin: string): Promise<void> {
    // no concept of pin in Phantom
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async sendPassphrase(passphrase: string): Promise<void> {
    // cannot send passphrase to Phantom. Could show the widget?
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async sendCharacter(charater: string): Promise<void> {
    // no concept of sendCharacter in Phantom
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async sendWord(word: string): Promise<void> {
    // no concept of sendWord in Phantom
  }

  public async cancel(): Promise<void> {
    // no concept of cancel in Phantom
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  public async wipe(): Promise<void> {}

  // eslint-disable-next-line @typescript-eslint/no-empty-function, @typescript-eslint/no-unused-vars
  public async reset(msg: core.ResetDevice): Promise<void> {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async recover(msg: core.RecoverDevice): Promise<void> {
    // no concept of recover in Phantom
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async loadDevice(msg: core.LoadDevice): Promise<void> {
    // TODO: Does Phantom allow this to be done programatically?
  }

  public describePath(msg: core.DescribePath): core.PathDescription {
    return this.info.describePath(msg);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async getPublicKeys(msg: Array<core.GetPublicKey>): Promise<Array<core.PublicKey | null>> {
    // Ethereum public keys are not exposed by the RPC API
    return [];
  }

  public async isInitialized(): Promise<boolean> {
    return true;
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  public async disconnect(): Promise<void> {}

  public async ethSupportsNetwork(chainId = 1): Promise<boolean> {
    return chainId === 1;
  }

  public async ethGetChainId(): Promise<number | null> {
    try {
      // chainId as hex string
      const chainId: string = await this.provider.request({ method: "eth_chainId" });
      return parseInt(chainId, 16);
    } catch (e) {
      console.error(e);
      return null;
    }
  }

  public async ethSwitchChain(params: AddEthereumChainParameter): Promise<void> {
    try {
      // at this point, we know that we're in the context of a valid Phantom provider
      await this.provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: params.chainId }] });
    } catch (e: any) {
      const error = serializeError(e);

      if (error.code === 4001) {
        throw ethErrors.provider.userRejectedRequest();
      }

      throw (error.data as any).originalError as {
        code: number;
        message: string;
        stack: string;
      };
    }
  }

  public async ethSupportsSecureTransfer(): Promise<boolean> {
    return false;
  }

  public ethSupportsNativeShapeShift(): boolean {
    return false;
  }

  public async ethSupportsEIP1559(): Promise<boolean> {
    return true;
  }

  public ethGetAccountPaths(msg: core.ETHGetAccountPath): Array<core.ETHAccountPath> {
    return eth.ethGetAccountPaths(msg);
  }

  public ethNextAccountPath(msg: core.ETHAccountPath): core.ETHAccountPath | undefined {
    return this.info.ethNextAccountPath(msg);
  }

  // TODO: Respect msg.addressNList!
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async ethGetAddress(msg: core.ETHGetAddress): Promise<string | null> {
    if (this.ethAddress) {
      return this.ethAddress;
    }
    const address = await eth.ethGetAddress(this.provider);
    if (address) {
      this.ethAddress = address;
      return address;
    } else {
      this.ethAddress = null;
      return null;
    }
  }

  public async ethSignTx(msg: core.ETHSignTx): Promise<core.ETHSignedTx | null> {
    const address = await this.ethGetAddress(this.provider);
    return address ? eth.ethSignTx(msg, this.provider, address) : null;
  }

  public async ethSendTx(msg: core.ETHSignTx): Promise<core.ETHTxHash | null> {
    const address = await this.ethGetAddress(this.provider);
    return address ? eth.ethSendTx(msg, this.provider, address) : null;
  }

  public async ethSignMessage(msg: core.ETHSignMessage): Promise<core.ETHSignedMessage | null> {
    const address = await this.ethGetAddress(this.provider);
    return address ? eth.ethSignMessage(msg, this.provider, address) : null;
  }

  public async ethVerifyMessage(msg: core.ETHVerifyMessage): Promise<boolean | null> {
    return eth.ethVerifyMessage(msg, this.provider);
  }

  public async getDeviceID(): Promise<string> {
    return "phantom:" + (await this.ethGetAddress(this.provider));
  }

  public async getFirmwareVersion(): Promise<string> {
    return "phantom";
  }
}
