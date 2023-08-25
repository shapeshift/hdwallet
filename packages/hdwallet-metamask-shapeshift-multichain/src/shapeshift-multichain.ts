import * as core from "@shapeshiftoss/hdwallet-core";
import { AddEthereumChainParameter } from "@shapeshiftoss/hdwallet-core";
import { ethErrors, serializeError } from "eth-rpc-errors";
import _ from "lodash";

import * as Binance from "./binance";
import * as Btc from "./bitcoin";
import * as BtcCash from "./bitcoincash";
import * as Cosmos from "./cosmos";
import * as Doge from "./dogecoin";
import * as Eth from "./ethereum";
import * as Kava from "./kava";
import * as Litecoin from "./litecoin";
import * as Osmosis from "./osmosis";
import * as Secret from "./secret";
import * as Terra from "./terra";
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
  readonly _supportsBinanceInfo = true;
  readonly _supportsRippleInfo = false;
  readonly _supportsEosInfo = false;
  readonly _supportsFioInfo = false;
  readonly _supportsThorchainInfo = true;
  readonly _supportsSecretInfo = true;
  readonly _supportsKavaInfo = true;
  readonly _supportsTerraInfo = true;

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
      case "binance":
        return core.binanceDescribePath(msg.path);
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

      case "kava":
      case "tkava":
        return core.kavaDescribePath(msg.path);

      case "osmosis":
      case "osmo":
        return core.osmosisDescribePath(msg.path);

      case "secret":
      case "scrt":
      case "tscrt":
        return core.secretDescribePath(msg.path);

      case "luna":
      case "terra":
      case "tluna":
        return core.terraDescribePath(msg.path);

      case "rune":
      case "trune":
      case "thorchain":
        return core.thorchainDescribePath(msg.path);

      default:
        throw new Error("Unsupported path");
    }
  }

  public async binanceSupportsNetwork(chainId = 714): Promise<boolean> {
    return chainId === 714;
  }

  public async binanceSupportsSecureTransfer(): Promise<boolean> {
    return false;
  }

  public binanceSupportsNativeShapeShift(): boolean {
    return false;
  }

  public binanceGetAccountPaths(msg: core.BinanceGetAccountPaths): Array<core.BinanceAccountPath> {
    return Binance.binanceGetAccountPaths(msg);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public binanceNextAccountPath(msg: core.BinanceAccountPath): core.BinanceAccountPath | undefined {
    // TODO: What do we do here?
    return undefined;
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

  public async kavaSupportsNetwork(chainId = 459): Promise<boolean> {
    return chainId === 459;
  }

  public async kavaSupportsSecureTransfer(): Promise<boolean> {
    return false;
  }

  public kavaSupportsNativeShapeShift(): boolean {
    return false;
  }

  public kavaGetAccountPaths(msg: core.KavaGetAccountPaths): Array<core.KavaAccountPath> {
    return Kava.kavaGetAccountPaths(msg);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public kavaNextAccountPath(msg: core.KavaAccountPath): core.KavaAccountPath | undefined {
    // TODO: What do we do here?
    return undefined;
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
    return Osmosis.osmosisGetAccountPaths(msg);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public osmosisNextAccountPath(msg: core.OsmosisAccountPath): core.OsmosisAccountPath | undefined {
    // TODO: What do we do here?
    return undefined;
  }

  public async secretSupportsNetwork(chainId = 529): Promise<boolean> {
    return chainId === 529;
  }

  public async secretSupportsSecureTransfer(): Promise<boolean> {
    return false;
  }

  public secretSupportsNativeShapeShift(): boolean {
    return false;
  }

  public secretGetAccountPaths(msg: core.SecretGetAccountPaths): Array<core.SecretAccountPath> {
    return Secret.secretGetAccountPaths(msg);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public secretNextAccountPath(msg: core.SecretAccountPath): core.SecretAccountPath | undefined {
    // TODO: What do we do here?
    return undefined;
  }

  public async terraSupportsNetwork(chainId = 330): Promise<boolean> {
    return chainId === 330;
  }

  public async terraSupportsSecureTransfer(): Promise<boolean> {
    return false;
  }

  public terraSupportsNativeShapeShift(): boolean {
    return false;
  }

  public terraGetAccountPaths(msg: core.TerraGetAccountPaths): Array<core.TerraAccountPath> {
    return Terra.terraGetAccountPaths(msg);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public terraNextAccountPath(msg: core.TerraAccountPath): core.TerraAccountPath | undefined {
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
  implements
    core.HDWallet,
    core.BTCWallet,
    core.ETHWallet,
    core.CosmosWallet,
    core.OsmosisWallet,
    core.ThorchainWallet,
    core.SecretWallet,
    core.TerraWallet,
    core.KavaWallet
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
  readonly _supportsBinanceInfo = true;
  readonly _supportsBinance = true;
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
  readonly _supportsSecretInfo = true;
  readonly _supportsSecret = true;
  readonly _supportsKava = true;
  readonly _supportsKavaInfo = true;
  readonly _supportsTerra = true;
  readonly _supportsTerraInfo = true;

  info: MetaMaskShapeShiftMultiChainHDWalletInfo & core.HDWalletInfo;
  binanceAddress?: string | null;
  bitcoinAddress?: string | null;
  bitcoinCashAddress?: string | null;
  cosmosAddress?: string | null;
  dogecoinAddress?: string | null;
  ethAddress?: string | null;
  kavaAddress?: string | null;
  litecoinAddress?: string | null;
  osmosisAddress?: string | null;
  secretAddress?: string | null;
  terraAddress?: string | null;
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async getPublicKeys(msg: Array<core.GetPublicKey>): Promise<Array<core.PublicKey | null>> {
    // Ethereum public keys are not exposed by the RPC API
    return [];
  }

  public async isInitialized(): Promise<boolean> {
    return true;
  }

  /** INSERT NEW CODE HERE */

  /** BINANCE */

  public async binanceSupportsSecureTransfer(): Promise<boolean> {
    return false;
  }

  public binanceSupportsNativeShapeShift(): boolean {
    return false;
  }

  public binanceGetAccountPaths(msg: core.BinanceGetAccountPaths): Array<core.BinanceAccountPath> {
    return Binance.binanceGetAccountPaths(msg);
  }

  public binanceNextAccountPath(msg: core.BinanceAccountPath): core.BinanceAccountPath | undefined {
    return this.info.binanceNextAccountPath(msg);
  }

  public async binanceGetAddress(msg: core.BinanceGetAddress): Promise<string | null> {
    if (this.binanceAddress) {
      return this.binanceAddress;
    }
    const address = await Binance.binanceGetAddress(msg);
    if (address) {
      this.binanceAddress = address;
      return address;
    } else {
      this.binanceAddress = null;
      return null;
    }
  }

  public async binanceSignTx(msg: core.BinanceSignTx): Promise<core.BinanceSignedTx | null> {
    const address = await Binance.binanceGetAddress(msg);
    return address ? Binance.binanceSignTx(msg) : null;
  }

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

  public async btcGetAddress(msg: core.BTCGetAddress): Promise<string | null> {
    if (this.bitcoinAddress) {
      return this.bitcoinAddress;
    }
    const address = await Btc.bitcoinGetAddress(msg);
    if (address) {
      this.bitcoinAddress = address;
      return address;
    } else {
      this.bitcoinAddress = null;
      return null;
    }
  }

  public async btcSignTx(msg: core.BTCSignTx): Promise<core.BTCSignedTx | null> {
    return Btc.bitcoinSignTx(msg);
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
    if (address) {
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
    if (address) {
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

  /** KAVA */

  public async kavaSupportsSecureTransfer(): Promise<boolean> {
    return false;
  }

  public kavaSupportsNativeShapeShift(): boolean {
    return false;
  }

  public kavaGetAccountPaths(msg: core.KavaGetAccountPaths): Array<core.KavaAccountPath> {
    return Kava.kavaGetAccountPaths(msg);
  }

  public kavaNextAccountPath(msg: core.KavaAccountPath): core.KavaAccountPath | undefined {
    return this.info.kavaNextAccountPath(msg);
  }

  public async kavaGetAddress(msg: core.KavaGetAddress): Promise<string | null> {
    if (this.kavaAddress) {
      return this.kavaAddress;
    }
    const address = await Kava.kavaGetAddress(msg);
    if (address) {
      this.kavaAddress = address;
      return address;
    } else {
      this.kavaAddress = null;
      return null;
    }
  }

  public async kavaSignTx(msg: core.KavaSignTx): Promise<core.KavaSignedTx | null> {
    const address = await this.kavaGetAddress(this.provider);
    return address ? Kava.kavaSignTx(msg) : null;
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
    if (address) {
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

  /** OSMOSIS */

  public async osmosisSupportsSecureTransfer(): Promise<boolean> {
    return false;
  }

  public osmosisSupportsNativeShapeShift(): boolean {
    return false;
  }

  public osmosisGetAccountPaths(msg: core.OsmosisGetAccountPaths): Array<core.OsmosisAccountPath> {
    return Osmosis.osmosisGetAccountPaths(msg);
  }

  public osmosisNextAccountPath(msg: core.OsmosisAccountPath): core.OsmosisAccountPath | undefined {
    return this.info.osmosisNextAccountPath(msg);
  }

  public async osmosisGetAddress(msg: core.OsmosisGetAddress): Promise<string | null> {
    if (this.osmosisAddress) {
      return this.osmosisAddress;
    }
    const address = await Osmosis.osmosisGetAddress(msg);
    if (address) {
      this.osmosisAddress = address;
      return address;
    } else {
      this.osmosisAddress = null;
      return null;
    }
  }

  public async osmosisSignTx(msg: core.OsmosisSignTx): Promise<core.OsmosisSignedTx | null> {
    const address = await this.osmosisGetAddress(this.provider);
    return address ? Osmosis.osmosisSignTx(msg) : null;
  }

  /** SECRET */

  public async secretSupportsSecureTransfer(): Promise<boolean> {
    return false;
  }

  public secretSupportsNativeShapeShift(): boolean {
    return false;
  }

  public secretGetAccountPaths(msg: core.SecretGetAccountPaths): Array<core.SecretAccountPath> {
    return Secret.secretGetAccountPaths(msg);
  }

  public secretNextAccountPath(msg: core.SecretAccountPath): core.SecretAccountPath | undefined {
    return this.info.secretNextAccountPath(msg);
  }

  public async secretGetAddress(msg: core.SecretGetAddress): Promise<string | null> {
    if (this.secretAddress) {
      return this.secretAddress;
    }
    const address = await Secret.secretGetAddress(msg);
    if (address) {
      this.secretAddress = address;
      return address;
    } else {
      this.secretAddress = null;
      return null;
    }
  }

  public async secretSignTx(msg: core.SecretSignTx): Promise<core.SecretSignedTx | null> {
    const address = await this.secretGetAddress(this.provider);
    return address ? Secret.secretSignTx(msg) : null;
  }

  /** TERRA */

  public async terraSupportsSecureTransfer(): Promise<boolean> {
    return false;
  }

  public terraSupportsNativeShapeShift(): boolean {
    return false;
  }

  public terraGetAccountPaths(msg: core.TerraGetAccountPaths): Array<core.TerraAccountPath> {
    return Terra.terraGetAccountPaths(msg);
  }

  public terraNextAccountPath(msg: core.TerraAccountPath): core.TerraAccountPath | undefined {
    return this.info.terraNextAccountPath(msg);
  }

  public async terraGetAddress(msg: core.TerraGetAddress): Promise<string | null> {
    if (this.terraAddress) {
      return this.terraAddress;
    }
    const address = await Terra.terraGetAddress(msg);
    if (address) {
      this.terraAddress = address;
      return address;
    } else {
      this.terraAddress = null;
      return null;
    }
  }

  public async terraSignTx(msg: core.TerraSignTx): Promise<core.TerraSignedTx | null> {
    const address = await this.terraGetAddress(this.provider);
    return address ? Terra.terraSignTx(msg) : null;
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
    if (address) {
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
