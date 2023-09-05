import * as core from "@shapeshiftoss/hdwallet-core";
import { AddEthereumChainParameter } from "@shapeshiftoss/hdwallet-core";
import { ethErrors, serializeError } from "eth-rpc-errors";
import _ from "lodash";

import * as Btc from "./bitcoin";
import * as BtcCash from "./bitcoincash";
import * as Cosmos from "./cosmos";
import * as Doge from "./dogecoin";
import * as Eth from "./ethereum";
import * as Litecoin from "./litecoin";
import * as Thorchain from "./thorchain";
import * as utxo from "./utxo";

export function isMetaMask(wallet: core.HDWallet): wallet is MetaMaskShapeShiftMultiChainHDWallet {
  return _.isObject(wallet) && (wallet as any)._isMetaMask;
}

export class MetaMaskShapeShiftMultiChainHDWalletInfo implements core.HDWalletInfo, core.ETHWalletInfo {
  ethGetChainId?(): Promise<number | null> {
    throw new Error("Method not implemented.");
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  ethSwitchChain?(params: core.AddEthereumChainParameter): Promise<void> {
    throw new Error("Method not implemented.");
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  ethAddChain?(params: core.AddEthereumChainParameter): Promise<void> {
    throw new Error("Method not implemented.");
  }
  readonly _supportsBTCInfo = true;
  readonly _supportsETHInfo = true;
  readonly _supportsCosmosInfo = true;
  readonly _supportsBinanceInfo = false;
  readonly _supportsRippleInfo = false;
  readonly _supportsEosInfo = false;
  readonly _supportsFioInfo = false;
  readonly _supportsThorchainInfo = true;

  public getVendor(): string {
    return "MetaMask";
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
      case "bitcoin":
      case "bitcoincash":
      case "dogecoin":
      case "litecoin": {
        const unknown = core.unknownUTXOPath(msg.path, msg.coin, msg.scriptType);

        if (!msg.scriptType) return unknown;
        if (!utxo.utxoSupportsCoin(msg.coin)) return unknown;
        if (!utxo.utxoSupportsScriptType(msg.coin, msg.scriptType)) return unknown;

        return core.describeUTXOPath(msg.path, msg.coin, msg.scriptType);
      }

      case "atom":
        return core.cosmosDescribePath(msg.path);

      case "ethereum":
        return core.describeETHPath(msg.path);

      case "rune":
      case "trune":
      case "thorchain":
        return core.thorchainDescribePath(msg.path);

      default:
        throw new Error("Unsupported path");
    }
  }

  public async bitcoinSupportsNetwork(chainId = 0): Promise<boolean> {
    return chainId === 0;
  }

  public async bitcoinSupportsSecureTransfer(): Promise<boolean> {
    return false;
  }

  public bitcoinSupportsNativeShapeShift(): boolean {
    return false;
  }

  public bitcoinGetAccountPaths(msg: core.BTCGetAccountPaths): Array<core.BTCAccountPath> {
    return Btc.bitcoinGetAccountPaths(msg);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public bitcoinNextAccountPath(msg: core.BTCAccountPath): core.BTCAccountPath | undefined {
    // TODO: What do we do here?
    return undefined;
  }

  public async bitcoinCashSupportsNetwork(chainId = 145): Promise<boolean> {
    return chainId === 145;
  }

  public async bitcoinCashSupportsSecureTransfer(): Promise<boolean> {
    return false;
  }

  public bitcoinCashSupportsNativeShapeShift(): boolean {
    return false;
  }

  public bitcoinCashGetAccountPaths(msg: core.BTCGetAccountPaths): Array<core.BTCAccountPath> {
    return Btc.bitcoinGetAccountPaths(msg);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public bitcoinCashNextAccountPath(msg: core.BTCAccountPath): core.BTCAccountPath | undefined {
    // TODO: What do we do here?
    return undefined;
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
    return Cosmos.cosmosGetAccountPaths(msg);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public cosmosNextAccountPath(msg: core.CosmosAccountPath): core.CosmosAccountPath | undefined {
    // TODO: What do we do here?
    return undefined;
  }

  public async dogecoinSupportsNetwork(chainId = 3): Promise<boolean> {
    return chainId === 3;
  }

  public async dogecoinSupportsSecureTransfer(): Promise<boolean> {
    return false;
  }

  public dogecoinSupportsNativeShapeShift(): boolean {
    return false;
  }

  public dogecoinGetAccountPaths(msg: core.BTCGetAccountPaths): Array<core.BTCAccountPath> {
    return Doge.dogecoinGetAccountPaths(msg);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public dogecoinNextAccountPath(msg: core.BTCAccountPath): core.BTCAccountPath | undefined {
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

  public ethGetAccountPaths(msg: core.ETHGetAccountPath): Array<core.ETHAccountPath> {
    return Eth.ethGetAccountPaths(msg);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public ethNextAccountPath(msg: core.ETHAccountPath): core.ETHAccountPath | undefined {
    // TODO: What do we do here?
    return undefined;
  }

  public async ethSupportsEIP1559(): Promise<boolean> {
    return true;
  }

  public async litecoinSupportsNetwork(chainId = 2): Promise<boolean> {
    return chainId === 2;
  }

  public async litecoinSupportsSecureTransfer(): Promise<boolean> {
    return false;
  }

  public litecoinSupportsNativeShapeShift(): boolean {
    return false;
  }

  public litecoinGetAccountPaths(msg: core.BTCGetAccountPaths): Array<core.BTCAccountPath> {
    return Litecoin.litecoinGetAccountPaths(msg);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public litecoinNextAccountPath(msg: core.BTCAccountPath): core.BTCAccountPath | undefined {
    // TODO: What do we do here?
    return undefined;
  }

  public async thorchainSupportsNetwork(chainId = 931): Promise<boolean> {
    return chainId === 931;
  }

  public async thorchainSupportsSecureTransfer(): Promise<boolean> {
    return false;
  }

  public thorchainSupportsNativeShapeShift(): boolean {
    return false;
  }

  public thorchainGetAccountPaths(msg: core.ThorchainGetAccountPaths): Array<core.ThorchainAccountPath> {
    return Thorchain.thorchainGetAccountPaths(msg);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public thorchainNextAccountPath(msg: core.ThorchainAccountPath): core.ThorchainAccountPath | undefined {
    // TODO: What do we do here?
    return undefined;
  }
}

export class MetaMaskShapeShiftMultiChainHDWallet
  implements core.HDWallet, core.BTCWallet, core.ETHWallet, core.CosmosWallet, core.ThorchainWallet
{
  readonly _supportsETH = true;
  readonly _supportsETHInfo = true;
  readonly _supportsBTCInfo = true;
  readonly _supportsBTC = true;
  readonly _supportsCosmosInfo = true;
  readonly _supportsCosmos = true;
  readonly _supportsEthSwitchChain = true;
  readonly _supportsAvalanche = true;
  readonly _supportsOptimism = true;
  readonly _supportsBSC = true;
  readonly _supportsPolygon = true;
  readonly _supportsGnosis = true;
  readonly _supportsOsmosisInfo = true;
  readonly _supportsOsmosis = true;
  readonly _supportsBinanceInfo = false;
  readonly _supportsBinance = false;
  readonly _supportsDebugLink = false;
  readonly _isPortis = false;
  readonly _isMetaMask = true;
  readonly _supportsRippleInfo = false;
  readonly _supportsRipple = false;
  readonly _supportsEosInfo = false;
  readonly _supportsEos = false;
  readonly _supportsFioInfo = false;
  readonly _supportsFio = false;
  readonly _supportsThorchainInfo = true;
  readonly _supportsThorchain = true;

  info: MetaMaskShapeShiftMultiChainHDWalletInfo & core.HDWalletInfo;
  bitcoinAddress?: string | null;
  bitcoinCashAddress?: string | null;
  cosmosAddress?: string | null;
  dogecoinAddress?: string | null;
  ethAddress?: string | null;
  litecoinAddress?: string | null;
  osmosisAddress?: string | null;
  thorchainAddress?: string | null;
  provider: any;

  constructor(provider: unknown) {
    this.info = new MetaMaskShapeShiftMultiChainHDWalletInfo();
    this.provider = provider;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  ethSignTypedData?(msg: core.ETHSignTypedData): Promise<core.ETHSignedTypedData | null> {
    throw new Error("Method not implemented.");
  }
  transport?: core.Transport | undefined;

  async getFeatures(): Promise<Record<string, any>> {
    return {};
  }

  public async isLocked(): Promise<boolean> {
    return !this.provider._metamask.isUnlocked();
  }

  public getVendor(): string {
    return "MetaMask";
  }

  public async getModel(): Promise<string> {
    return "MetaMask";
  }

  public async getLabel(): Promise<string> {
    return "MetaMask";
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
    // TODO: Can we lock MetaMask from here?
  }

  public async ping(msg: core.Ping): Promise<core.Pong> {
    // no ping function for MetaMask, so just returning Core.Pong
    return { msg: msg.msg };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async sendPin(pin: string): Promise<void> {
    // no concept of pin in MetaMask
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async sendPassphrase(passphrase: string): Promise<void> {
    // cannot send passphrase to MetaMask. Could show the widget?
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async sendCharacter(charater: string): Promise<void> {
    // no concept of sendCharacter in MetaMask
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async sendWord(word: string): Promise<void> {
    // no concept of sendWord in MetaMask
  }

  public async cancel(): Promise<void> {
    // no concept of cancel in MetaMask
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  public async wipe(): Promise<void> {}

  // eslint-disable-next-line @typescript-eslint/no-empty-function, @typescript-eslint/no-unused-vars
  public async reset(msg: core.ResetDevice): Promise<void> {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async recover(msg: core.RecoverDevice): Promise<void> {
    // no concept of recover in MetaMask
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async loadDevice(msg: core.LoadDevice): Promise<void> {
    // TODO: Does MetaMask allow this to be done programatically?
  }

  public describePath(msg: core.DescribePath): core.PathDescription {
    return this.info.describePath(msg);
  }

  publicKeysCache: Map<string, Array<core.PublicKey | null>> = new Map();
  public async getPublicKeys(msg: Array<core.GetPublicKey>): Promise<Array<core.PublicKey | null>> {
    const key = JSON.stringify(msg);
    const maybeCachedPublicKeys = this.publicKeysCache.get(key);

    if (maybeCachedPublicKeys) {
      return maybeCachedPublicKeys;
    }

    const pubKeys = await Promise.all(
      msg.map(async (getPublicKey) => {
        switch (getPublicKey.coin) {
          case "Bitcoin":
            return Btc.bitcoinGetPublicKeys(getPublicKey);
          case "Litecoin":
            return Litecoin.litecoinGetPublicKeys(getPublicKey);
          case "Dogecoin":
            return Doge.dogecoinGetPublicKeys(getPublicKey);
          case "BitcoinCash":
            return BtcCash.bitcoinCashGetPublicKeys(getPublicKey);
          default:
            return null;
        }
      })
    );

    const flattened = pubKeys.flat();
    const filtered = flattened.filter((x) => x !== null) as Array<core.PublicKey>;

    // Cache the result
    this.publicKeysCache.set(key, filtered);

    return filtered;
  }
  public async isInitialized(): Promise<boolean> {
    return true;
  }

  /** INSERT NEW CODE HERE */

  /** BITCOIN */

  public async btcSupportsSecureTransfer(): Promise<boolean> {
    return false;
  }

  public btcSupportsNativeShapeShift(): boolean {
    return false;
  }

  public btcGetAccountPaths(msg: core.BTCGetAccountPaths): Array<core.BTCAccountPath> {
    return Btc.bitcoinGetAccountPaths(msg);
  }

  public btcNextAccountPath(msg: core.BTCAccountPath): core.BTCAccountPath | undefined {
    return this.info.bitcoinNextAccountPath(msg);
  }

  addressCache: Map<string, string> = new Map();
  public async btcGetAddress(msg: core.BTCGetAddress): Promise<string | null> {
    const key = JSON.stringify(msg);
    const maybeCachedAddress = this.addressCache.get(key);
    if (maybeCachedAddress) return maybeCachedAddress;
    const value = await (async () => {
      switch (msg.coin) {
        case "Bitcoin":
          return Btc.bitcoinGetAddress(msg);
        case "Litecoin":
          return Litecoin.litecoinGetAddress(msg);
        case "Dogecoin":
          return Doge.dogecoinGetAddress(msg);
        case "BitcoinCash":
          return BtcCash.bitcoinCashGetAddress(msg);
        default:
          return null;
      }
    })();
    if (!value || typeof value !== "string") return null;

    this.addressCache.set(key, value);
    return value;
  }

  public async btcSignTx(msg: core.BTCSignTx): Promise<core.BTCSignedTx | null> {
    const { coin } = msg;
    switch (coin) {
      case "Bitcoin":
        return Btc.bitcoinSignTx(msg);
      case "Litecoin":
        return Litecoin.litecoinSignTx(msg);
      case "Dogecoin":
        return Doge.dogecoinSignTx(msg);
      case "BitcoinCash":
        return BtcCash.bitcoinCashSignTx(msg);
      default:
        return null;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async btcSignMessage(msg: core.BTCSignMessage): Promise<core.BTCSignedMessage | null> {
    throw new Error("Method not implemented.");
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async btcVerifyMessage(msg: core.BTCVerifyMessage): Promise<boolean | null> {
    throw new Error("Method not implemented.");
  }

  public async btcSupportsScriptType(coin: string, scriptType?: core.BTCInputScriptType | undefined): Promise<boolean> {
    return utxo.utxoSupportsScriptType(coin, scriptType);
  }

  public async btcSupportsCoin(coin: core.Coin): Promise<boolean> {
    return utxo.utxoSupportsCoin(coin);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public btcIsSameAccount(msg: core.BTCAccountPath[]): boolean {
    throw new Error("Method not implemented.");
  }

  /** BITCOIN CASH */

  public async bitcoinCashSupportsSecureTransfer(): Promise<boolean> {
    return false;
  }

  public bitcoinCashSupportsNativeShapeShift(): boolean {
    return false;
  }

  public bitcoinCashGetAccountPaths(msg: core.BTCGetAccountPaths): Array<core.BTCAccountPath> {
    return BtcCash.bitcoinCashGetAccountPaths(msg);
  }

  public bitcoinCashNextAccountPath(msg: core.BTCAccountPath): core.BTCAccountPath | undefined {
    return this.info.bitcoinCashNextAccountPath(msg);
  }

  public async bitcoinCashGetAddress(msg: core.BTCGetAddress): Promise<string | null> {
    if (this.bitcoinCashAddress) {
      return this.bitcoinCashAddress;
    }
    const address = await BtcCash.bitcoinCashGetAddress(msg);
    if (address && typeof address === "string") {
      this.bitcoinCashAddress = address;
      return address;
    } else {
      this.bitcoinCashAddress = null;
      return null;
    }
  }

  public async bitcoinCashSignTx(msg: core.BTCSignTx): Promise<core.BTCSignedTx | null> {
    const address = await this.bitcoinCashGetAddress(this.provider);
    return address ? Btc.bitcoinSignTx(msg) : null;
  }

  /** COSMOS */

  public async cosmosSupportsSecureTransfer(): Promise<boolean> {
    return false;
  }

  public cosmosSupportsNativeShapeShift(): boolean {
    return false;
  }

  public cosmosGetAccountPaths(msg: core.CosmosGetAccountPaths): Array<core.CosmosAccountPath> {
    return Cosmos.cosmosGetAccountPaths(msg);
  }

  public cosmosNextAccountPath(msg: core.CosmosAccountPath): core.CosmosAccountPath | undefined {
    return this.info.cosmosNextAccountPath(msg);
  }

  public async cosmosGetAddress(msg: core.CosmosGetAddress): Promise<string | null> {
    if (this.cosmosAddress) {
      return this.cosmosAddress;
    }
    const address = await Cosmos.cosmosGetAddress(msg);
    if (address && typeof address === "string") {
      this.cosmosAddress = address;
      return address;
    } else {
      this.cosmosAddress = null;
      return null;
    }
  }

  public async cosmosSignTx(msg: core.CosmosSignTx): Promise<core.CosmosSignedTx | null> {
    const address = await this.cosmosGetAddress(this.provider);
    return address ? Cosmos.cosmosSignTx(msg) : null;
  }

  /** DOGECOIN */

  public async dogecoinSupportsSecureTransfer(): Promise<boolean> {
    return false;
  }

  public dogecoinSupportsNativeShapeShift(): boolean {
    return false;
  }

  public dogecoinGetAccountPaths(msg: core.BTCGetAccountPaths): Array<core.BTCAccountPath> {
    return Doge.dogecoinGetAccountPaths(msg);
  }

  public dogecoinNextAccountPath(msg: core.BTCAccountPath): core.BTCAccountPath | undefined {
    return this.info.dogecoinNextAccountPath(msg);
  }

  public async dogecoinGetAddress(msg: core.BTCGetAddress): Promise<string | null> {
    if (this.dogecoinAddress) {
      return this.dogecoinAddress;
    }
    const address = await Doge.dogecoinGetAddress(msg);
    if (address && typeof address === "string") {
      this.dogecoinAddress = address;
      return address;
    } else {
      this.dogecoinAddress = null;
      return null;
    }
  }

  public async dogecoinSignTx(msg: core.BTCSignTx): Promise<core.BTCSignedTx | null> {
    const address = await this.dogecoinGetAddress(this.provider);
    return address ? Doge.dogecoinSignTx(msg) : null;
  }

  /** ETHEREUM */

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

  public async ethAddChain(params: AddEthereumChainParameter): Promise<void> {
    // at this point, we know that we're in the context of a valid MetaMask provider
    await this.provider.request({ method: "wallet_addEthereumChain", params: [params] });
  }

  public async ethSwitchChain(params: AddEthereumChainParameter): Promise<void> {
    try {
      // at this point, we know that we're in the context of a valid MetaMask provider
      await this.provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: params.chainId }] });
    } catch (e: any) {
      const error = serializeError(e);
      // https://docs.metamask.io/guide/ethereum-provider.html#errors
      // Internal error, which in the case of wallet_switchEthereumChain call means the chain isn't currently added to the wallet
      if (error.code === -32603) {
        // We only support Avalanche C-Chain currently. It is supported natively in XDEFI, and unsupported in Tally, both with no capabilities to add a new chain
        // TODO(gomes): Find a better home for these. When that's done, we'll want to call ethSwitchChain with (params: AddEthereumChainParameter) instead
        try {
          await this.ethAddChain(params);
          return;
        } catch (addChainE: any) {
          const addChainError = serializeError(addChainE);

          if (addChainError.code === 4001) {
            throw ethErrors.provider.userRejectedRequest();
          }

          throw (addChainError.data as any).originalError as {
            code: number;
            message: string;
            stack: string;
          };
        }
      }

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
    return Eth.ethGetAccountPaths(msg);
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
    const address = await Eth.ethGetAddress(this.provider);
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
    return address ? Eth.ethSignTx(msg, this.provider, address) : null;
  }

  public async ethSendTx(msg: core.ETHSignTx): Promise<core.ETHTxHash | null> {
    const txid = await this.ethGetAddress(this.provider);
    return txid ? Eth.ethSendTx(msg, this.provider, txid) : null;
  }

  public async ethSignMessage(msg: core.ETHSignMessage): Promise<core.ETHSignedMessage | null> {
    const signedMessage = await this.ethGetAddress(this.provider);
    return signedMessage ? Eth.ethSignMessage(msg, this.provider, signedMessage) : null;
  }

  public async ethVerifyMessage(msg: core.ETHVerifyMessage): Promise<boolean | null> {
    return Eth.ethVerifyMessage(msg, this.provider);
  }

  /** LITECOIN */

  public async litecoinSupportsSecureTransfer(): Promise<boolean> {
    return false;
  }

  public litecoinSupportsNativeShapeShift(): boolean {
    return false;
  }

  public litecoinGetAccountPaths(msg: core.BTCGetAccountPaths): Array<core.BTCAccountPath> {
    return Litecoin.litecoinGetAccountPaths(msg);
  }

  public litecoinNextAccountPath(msg: core.BTCAccountPath): core.BTCAccountPath | undefined {
    return this.info.litecoinNextAccountPath(msg);
  }

  public async litecoinGetAddress(msg: core.BTCGetAddress): Promise<string | null> {
    if (this.litecoinAddress) {
      return this.litecoinAddress;
    }
    const address = await Litecoin.litecoinGetAddress(msg);
    if (address && typeof address === "string") {
      this.litecoinAddress = address;
      return address;
    } else {
      this.litecoinAddress = null;
      return null;
    }
  }

  public async litecoinSignTx(msg: core.BTCSignTx): Promise<core.BTCSignedTx | null> {
    const address = await this.litecoinGetAddress(this.provider);
    return address ? Litecoin.litecoinSignTx(msg) : null;
  }

  /** THORCHAIN */

  public async thorchainSupportsSecureTransfer(): Promise<boolean> {
    return false;
  }

  public thorchainSupportsNativeShapeShift(): boolean {
    return false;
  }

  public thorchainGetAccountPaths(msg: core.ThorchainGetAccountPaths): Array<core.ThorchainAccountPath> {
    return Thorchain.thorchainGetAccountPaths(msg);
  }

  public thorchainNextAccountPath(msg: core.ThorchainAccountPath): core.ThorchainAccountPath | undefined {
    return this.info.thorchainNextAccountPath(msg);
  }

  public async thorchainGetAddress(msg: core.ThorchainGetAddress): Promise<string | null> {
    if (this.thorchainAddress) {
      return this.thorchainAddress;
    }
    const address = await Thorchain.thorchainGetAddress(msg);
    if (address && typeof address === "string") {
      this.thorchainAddress = address;
      return address;
    } else {
      this.thorchainAddress = null;
      return null;
    }
  }

  public async thorchainSignTx(msg: core.ThorchainSignTx): Promise<core.ThorchainSignedTx | null> {
    const address = await this.thorchainGetAddress(this.provider);
    return address ? Thorchain.thorchainSignTx(msg) : null;
  }

  public async getDeviceID(): Promise<string> {
    return "metaMask:" + (await this.ethGetAddress(this.provider));
  }

  public async getFirmwareVersion(): Promise<string> {
    return "metaMask";
  }
}
