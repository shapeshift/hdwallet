import * as core from "@shapeshiftoss/hdwallet-core";
import { AddEthereumChainParameter, BTCInputScriptType } from "@shapeshiftoss/hdwallet-core";
import { providers } from "ethers";
import _ from "lodash";

import * as Btc from "./bitcoin";
import { BtcAccount } from "./bitcoin";
import * as eth from "./ethereum";
import { PhantomEvmProvider } from "./types";

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

  bitcoinAddress?: string | null;
  ethAddress?: string | null;

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
      case "bitcoin": {
        const unknown = core.unknownUTXOPath(msg.path, msg.coin, msg.scriptType);

        if (!msg.scriptType) return unknown;

        return core.describeUTXOPath(msg.path, msg.coin, msg.scriptType);
      }
      case "ethereum":
        return core.describeETHPath(msg.path);
      default:
        throw new Error("Unsupported path");
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public ethNextAccountPath(msg: core.ETHAccountPath): core.ETHAccountPath | undefined {
    throw new Error("Unimplemented");
  }

  public async ethSupportsNetwork(chainId: number): Promise<boolean> {
    return chainId === 1 || chainId === 137;
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
  evmProvider: PhantomEvmProvider;
  bitcoinProvider: providers.ExternalProvider;

  constructor(evmProvider: PhantomEvmProvider, bitcoinProvider: providers.ExternalProvider) {
    this.info = new PhantomHDWalletInfo();
    this.evmProvider = evmProvider;
    this.bitcoinProvider = bitcoinProvider;
  }

  async getFeatures(): Promise<Record<string, any>> {
    return {};
  }

  public async isLocked(): Promise<boolean> {
    return !this.evmProvider._metamask.isUnlocked();
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
    // Only p2wpkh effectively supported for now
    if (msg[0].coin !== "Bitcoin") return [];
    if (msg[0].scriptType !== BTCInputScriptType.SpendWitness) return [];

    // Note this is a pubKey, not an xpub
    const pubKey = await this.btcGetAddress({ coin: "Bitcoin" } as core.BTCGetAddress);
    if (!pubKey) return [];
    // Ethereum public keys are not exposed by the RPC API
    return [{ xpub: pubKey }];
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
      if (!this.evmProvider.request) throw new Error("Provider does not support ethereum.request");
      // chainId as hex string
      const chainId: string = await this.evmProvider.request({ method: "eth_chainId" });
      return parseInt(chainId, 16);
    } catch (e) {
      console.error(e);
      return null;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async ethSwitchChain(params: AddEthereumChainParameter): Promise<void> {
    // no concept of switch chain in phantom
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

  public async ethGetAddress(): Promise<string | null> {
    if (this.ethAddress) {
      return this.ethAddress;
    }
    const address = await eth.ethGetAddress(this.evmProvider);
    if (address) {
      this.ethAddress = address;
      return address;
    } else {
      this.ethAddress = null;
      return null;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async ethSignTx(msg: core.ETHSignTx): Promise<core.ETHSignedTx | null> {
    throw new Error("unimplemented");
  }

  public async ethSendTx(msg: core.ETHSignTx): Promise<core.ETHTxHash | null> {
    const address = await this.ethGetAddress();
    return address ? eth.ethSendTx(msg, this.evmProvider, address) : null;
  }

  public async ethSignMessage(msg: core.ETHSignMessage): Promise<core.ETHSignedMessage | null> {
    const address = await this.ethGetAddress();
    return address ? eth.ethSignMessage(msg, this.evmProvider, address) : null;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async ethVerifyMessage(msg: core.ETHVerifyMessage): Promise<boolean | null> {
    throw new Error("Method not implemented.");
  }

  public async getDeviceID(): Promise<string> {
    return "phantom:" + (await this.ethGetAddress());
  }

  public async getFirmwareVersion(): Promise<string> {
    return "phantom";
  }

  /** BITCOIN */

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public bitcoinNextAccountPath(msg: core.BTCAccountPath): core.BTCAccountPath | undefined {
    throw new Error("Method not implemented.");
  }

  public async btcSupportsSecureTransfer(): Promise<boolean> {
    return false;
  }

  public btcSupportsNativeShapeShift(): boolean {
    return false;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public btcGetAccountPaths(msg: core.BTCGetAccountPaths): Array<core.BTCAccountPath> {
    // Phantom doesn't support BIP44 paths
    throw new Error("Method not implemented.");
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public btcNextAccountPath(_msg: core.BTCAccountPath): core.BTCAccountPath | undefined {
    // Phantom doesn't support BIP44 paths
    throw new Error("Method not implemented.");
  }

  public async btcGetAddress(msg: core.BTCGetAddress): Promise<string | null> {
    const value = await (async () => {
      switch (msg.coin) {
        case "Bitcoin": {
          // TODO(gomes): type this
          const accounts = await (this.bitcoinProvider as any).requestAccounts();
          const paymentAddress = accounts.find((account: BtcAccount) => account.purpose === "payment")?.address;

          return paymentAddress;
        }
        default:
          return null;
      }
    })();
    if (!value || typeof value !== "string") return null;

    return value;
  }

  public async btcSignTx(msg: core.BTCSignTx): Promise<core.BTCSignedTx | null> {
    const { coin } = msg;
    switch (coin) {
      case "Bitcoin":
        return Btc.bitcoinSignTx(this, msg, this.bitcoinProvider);
      default:
        return null;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async btcSignMessage(msg: core.BTCSignMessage): Promise<core.BTCSignedMessage | null> {
    const address = await this.btcGetAddress({ coin: "Bitcoin" } as core.BTCGetAddress);
    if (!address) throw new Error("Could not get Bitcoin address");
    const message = new TextEncoder().encode(msg.message);

    // TODO(gomes): type bitcoinpovider
    const { signature } = await (this.bitcoinProvider as any).signMessage(address, message);
    return { signature, address };
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async btcVerifyMessage(msg: core.BTCVerifyMessage): Promise<boolean | null> {
    throw new Error("Method not implemented.");
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async btcSupportsScriptType(coin: string, scriptType?: core.BTCInputScriptType | undefined): Promise<boolean> {
    throw new Error("Method not implemented.");
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async btcSupportsCoin(coin: core.Coin): Promise<boolean> {
    return coin === "bitcoin";
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public btcIsSameAccount(msg: core.BTCAccountPath[]): boolean {
    throw new Error("Method not implemented.");
  }
}
