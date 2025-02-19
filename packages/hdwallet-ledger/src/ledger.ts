import * as core from "@shapeshiftoss/hdwallet-core";
import isObject from "lodash/isObject";

import * as btc from "./bitcoin";
import * as cosmos from "./cosmos";
import * as eth from "./ethereum";
import * as solana from "./solana";
import * as thorchain from "./thorchain";
import { LedgerTransport } from "./transport";
import { coinToLedgerAppName, handleError } from "./utils";

export function isLedger(wallet: core.HDWallet): wallet is LedgerHDWallet {
  return isObject(wallet) && (wallet as any)._isLedger;
}

function describeETHPath(path: core.BIP32Path): core.PathDescription {
  const pathStr = core.addressNListToBIP32(path);
  const unknown: core.PathDescription = {
    verbose: pathStr,
    coin: "Ethereum",
    isKnown: false,
  };

  if (path.length !== 5 && path.length !== 4) return unknown;

  if (path[0] !== 0x80000000 + 44) return unknown;

  if (path[1] !== 0x80000000 + core.slip44ByCoin("Ethereum")) return unknown;

  if ((path[2] & 0x80000000) >>> 0 !== 0x80000000) return unknown;

  let accountIdx;
  if (path.length === 5) {
    if (path[3] !== 0) return unknown;

    if (path[4] !== 0) return unknown;

    accountIdx = (path[2] & 0x7fffffff) >>> 0;
  } else if (path.length === 4) {
    if (path[2] !== 0x80000000) return unknown;

    if ((path[3] & 0x80000000) >>> 0 === 0x80000000) return unknown;

    accountIdx = path[3];
  } else {
    return unknown;
  }

  return {
    verbose: `Ethereum Account #${accountIdx}`,
    wholeAccount: true,
    accountIdx,
    coin: "Ethereum",
    isKnown: true,
    isPrefork: false,
  };
}

function describeUTXOPath(path: core.BIP32Path, coin: core.Coin, scriptType?: core.BTCInputScriptType) {
  const pathStr = core.addressNListToBIP32(path);
  const unknown: core.PathDescription = {
    verbose: pathStr,
    coin,
    scriptType,
    isKnown: false,
  };

  if (!btc.btcSupportsCoin(coin)) return unknown;

  if (!btc.btcSupportsScriptType(coin, scriptType)) return unknown;

  if (path.length !== 3 && path.length !== 5) return unknown;

  if ((path[0] & 0x80000000) >>> 0 !== 0x80000000) return unknown;

  const purpose = path[0] & 0x7fffffff;

  if (![44, 49, 84].includes(purpose)) return unknown;

  if (purpose === 44 && scriptType !== core.BTCInputScriptType.SpendAddress) return unknown;

  if (purpose === 49 && scriptType !== core.BTCInputScriptType.SpendP2SHWitness) return unknown;

  if (purpose === 84 && scriptType !== core.BTCInputScriptType.SpendWitness) return unknown;

  const slip44 = core.slip44ByCoin(coin);
  if (slip44 === undefined || path[1] !== 0x80000000 + slip44) return unknown;

  const wholeAccount = path.length === 3;

  let script = scriptType
    ? (
        {
          [core.BTCInputScriptType.SpendAddress]: " (Legacy)",
          [core.BTCInputScriptType.SpendP2SHWitness]: "",
          [core.BTCInputScriptType.SpendWitness]: " (Segwit Native)",
        } as Partial<Record<core.BTCInputScriptType, string>>
      )[scriptType]
    : undefined;

  switch (coin) {
    case "Bitcoin":
    case "Litecoin":
    case "BitcoinGold":
    case "Testnet":
      break;
    default:
      script = "";
  }

  const accountIdx = path[2] & 0x7fffffff;

  if (wholeAccount) {
    return {
      verbose: `${coin} Account #${accountIdx}${script}`,
      accountIdx,
      coin,
      scriptType,
      wholeAccount: true,
      isKnown: true,
      isPrefork: false,
    };
  } else {
    const change = path[3] == 1 ? "Change " : "";
    const addressIdx = path[4];
    return {
      verbose: `${coin} Account #${accountIdx}, ${change}Address #${addressIdx}${script}`,
      coin,
      scriptType,
      accountIdx,
      addressIdx,
      wholeAccount: false,
      isChange: path[3] == 1,
      isKnown: true,
      isPrefork: false,
    };
  }
}

export class LedgerHDWalletInfo
  implements
    core.HDWalletInfo,
    core.BTCWalletInfo,
    core.ETHWalletInfo,
    core.ThorchainWalletInfo,
    core.CosmosWalletInfo,
    core.SolanaWalletInfo
{
  readonly _supportsBTCInfo = true;
  readonly _supportsETHInfo = true;
  readonly _supportsThorchainInfo = true;
  readonly _supportsCosmosInfo = true;
  readonly _supportsSolanaInfo = true;

  public getVendor(): string {
    return "Ledger";
  }

  public async btcSupportsCoin(coin: core.Coin): Promise<boolean> {
    return btc.btcSupportsCoin(coin);
  }

  public async btcSupportsScriptType(coin: core.Coin, scriptType: core.BTCInputScriptType): Promise<boolean> {
    return btc.btcSupportsScriptType(coin, scriptType);
  }

  public async btcSupportsSecureTransfer(): Promise<boolean> {
    return btc.btcSupportsSecureTransfer();
  }

  public btcSupportsNativeShapeShift(): boolean {
    return btc.btcSupportsNativeShapeShift();
  }

  public btcGetAccountPaths(msg: core.BTCGetAccountPaths): Array<core.BTCAccountPath> {
    return btc.btcGetAccountPaths(msg);
  }

  public async ethSupportsNetwork(chain_id: number): Promise<boolean> {
    return eth.ethSupportsNetwork(chain_id);
  }

  public async ethSupportsSecureTransfer(): Promise<boolean> {
    return eth.ethSupportsSecureTransfer();
  }

  public ethSupportsNativeShapeShift(): boolean {
    return eth.ethSupportsNativeShapeShift();
  }

  public async ethSupportsEIP1559(): Promise<boolean> {
    return eth.ethSupportsEIP1559();
  }

  public ethGetAccountPaths(msg: core.ETHGetAccountPath): Array<core.ETHAccountPath> {
    return eth.ethGetAccountPaths(msg);
  }

  public thorchainGetAccountPaths(msg: core.ThorchainGetAccountPaths): Array<core.ThorchainAccountPath> {
    const slip44 = core.slip44ByCoin("Thorchain");
    return [{ addressNList: [0x80000000 + 44, 0x80000000 + slip44, 0x80000000 + msg.accountIdx, 0, 0] }];
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public thorchainNextAccountPath(msg: core.ThorchainAccountPath): core.ThorchainAccountPath | undefined {
    return undefined;
  }

  public cosmosGetAccountPaths(msg: core.CosmosGetAccountPaths): Array<core.CosmosAccountPath> {
    const slip44 = core.slip44ByCoin("Atom");
    return [{ addressNList: [0x80000000 + 44, 0x80000000 + slip44, 0x80000000 + msg.accountIdx, 0, 0] }];
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public cosmosNextAccountPath(msg: core.CosmosAccountPath): core.CosmosAccountPath | undefined {
    return undefined;
  }

  public solanaGetAccountPaths(msg: core.SolanaGetAccountPaths): Array<core.SolanaAccountPath> {
    return core.solanaGetAccountPaths(msg);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public solanaNextAccountPath(msg: core.SolanaAccountPath): core.SolanaAccountPath | undefined {
    throw new Error("Method not implemented");
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public hasNativeShapeShift(srcCoin: core.Coin, dstCoin: core.Coin): boolean {
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

  public hasOnDeviceDisplay(): boolean {
    return true;
  }

  public hasOnDevicePassphrase(): boolean {
    return true;
  }

  public hasOnDevicePinEntry(): boolean {
    return true;
  }

  public hasOnDeviceRecovery(): boolean {
    return true;
  }

  public describePath(msg: core.DescribePath): core.PathDescription {
    switch (msg.coin) {
      case "Ethereum":
        return describeETHPath(msg.path);
      case "Thorchain":
        return core.thorchainDescribePath(msg.path);
      default:
        return describeUTXOPath(msg.path, msg.coin, msg.scriptType);
    }
  }

  public btcNextAccountPath(msg: core.BTCAccountPath): core.BTCAccountPath | undefined {
    const description = describeUTXOPath(msg.addressNList, msg.coin, msg.scriptType);
    if (!description.isKnown) {
      return undefined;
    }

    const addressNList = msg.addressNList;

    if (
      addressNList[0] === 0x80000000 + 44 ||
      addressNList[0] === 0x80000000 + 49 ||
      addressNList[0] === 0x80000000 + 84
    ) {
      addressNList[2] += 1;
      return {
        ...msg,
        addressNList,
      };
    }

    return undefined;
  }

  public ethNextAccountPath(msg: core.ETHAccountPath): core.ETHAccountPath | undefined {
    const addressNList = msg.hardenedPath.concat(msg.relPath);
    const description = describeETHPath(addressNList);
    if (!description.isKnown) {
      return undefined;
    }

    if (description.wholeAccount) {
      addressNList[2] += 1;
      return {
        ...msg,
        addressNList,
        hardenedPath: core.hardenedPath(addressNList),
        relPath: core.relativePath(addressNList),
      };
    }

    if (addressNList.length === 5) {
      addressNList[2] += 1;
      return {
        ...msg,
        hardenedPath: core.hardenedPath(addressNList),
        relPath: core.relativePath(addressNList),
      };
    }

    if (addressNList.length === 4) {
      addressNList[3] += 1;
      return {
        ...msg,
        hardenedPath: core.hardenedPath(addressNList),
        relPath: core.relativePath(addressNList),
      };
    }

    return undefined;
  }
}

export class LedgerHDWallet
  extends LedgerHDWalletInfo
  implements core.HDWallet, core.BTCWallet, core.ETHWallet, core.ThorchainWallet, core.CosmosWallet, core.SolanaWallet
{
  readonly _supportsBTC = true;
  readonly _supportsETH = true;
  readonly _supportsEthSwitchChain = false;
  readonly _supportsAvalanche = true;
  readonly _supportsOptimism = true;
  readonly _supportsBSC = true;
  readonly _supportsPolygon = true;
  readonly _supportsGnosis = true;
  readonly _supportsArbitrum = true;
  readonly _supportsArbitrumNova = true;
  readonly _supportsBase = true;
  readonly _supportsThorchain = true;
  readonly _supportsCosmos = true;
  readonly _supportsSolana = true;

  _isLedger = true;

  transport: LedgerTransport;
  info: LedgerHDWalletInfo & core.HDWalletInfo;

  constructor(transport: LedgerTransport) {
    super();
    this.transport = transport;
    this.info = new LedgerHDWalletInfo();
  }

  public async initialize(): Promise<any> {
    return;
  }

  public async isInitialized(): Promise<boolean> {
    // AFAICT, there isn't an API to figure this out, so we go with a reasonable
    // (ish) default:
    return true;
  }

  public async getDeviceID(): Promise<string> {
    return this.transport.getDeviceID();
  }

  public async getFeatures(): Promise<any> {
    const res = await this.transport.call(null, "getDeviceInfo");
    handleError(res, this.transport);
    return res.payload;
  }

  /**
   * Validate if a specific app is open
   * Throws WrongApp error if app associated with coin is not open
   * @param coin  Name of coin for app name lookup ie "BitcoinCash"
   */
  public async validateCurrentApp(coin?: core.Coin): Promise<void> {
    if (!coin) {
      throw new Error(`No coin provided`);
    }

    const appName = coinToLedgerAppName(coin);
    if (!appName) {
      throw new Error(`Unable to find associated app name for coin: ${coin}`);
    }

    const res = await this.transport.call(null, "getAppAndVersion");
    handleError(res, this.transport);

    const {
      payload: { name: currentApp },
    } = res;
    if (currentApp !== appName) {
      throw new core.WrongApp("Ledger", appName);
    }
  }

  /**
   * Prompt user to open given app on device
   * User must be in dashboard
   * @param appName - human-readable app name i.e. "Bitcoin Cash"
   */
  public async openApp(appName: string): Promise<void> {
    const res = await this.transport.call(null, "openApp", appName);
    handleError(res, this.transport);
  }

  public async getFirmwareVersion(): Promise<string> {
    const { version } = await this.getFeatures();
    return version;
  }

  public async getModel(): Promise<string> {
    const {
      device: { productName },
    } = this.transport as any;
    return productName;
  }

  public async getLabel(): Promise<string> {
    return "Ledger";
  }

  public async isLocked(): Promise<boolean> {
    return true;
  }

  public async clearSession(): Promise<void> {
    return;
  }

  public async getPublicKeys(msg: Array<core.GetPublicKey>): Promise<Array<core.PublicKey | null>> {
    const res = await this.transport.call(null, "getAppAndVersion");
    handleError(res, this.transport);

    const {
      payload: { name },
    } = res;

    const btcApps = new Set(btc.supportedCoins.map((x) => coinToLedgerAppName(x)).filter((x) => x !== undefined));
    if (btcApps.has(name)) return btc.btcGetPublicKeys(this.transport, msg);

    switch (name) {
      case "Ethereum":
        return eth.ethGetPublicKeys(this.transport, msg);
      default:
        throw new Error(`getPublicKeys is not supported with the ${name} app`);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async loadDevice(msg: core.LoadDevice): Promise<void> {
    return;
  }

  // Ledger doesn't have this, faking response here
  public async ping(msg: core.Ping): Promise<core.Pong> {
    return { msg: msg.msg };
  }

  public async cancel(): Promise<void> {
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async recover(msg: core.RecoverDevice): Promise<void> {
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async reset(msg: core.ResetDevice): Promise<void> {
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async sendCharacter(character: string): Promise<void> {
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async sendPassphrase(passphrase: string): Promise<void> {
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async sendPin(pin: string): Promise<void> {
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async sendWord(word: string): Promise<void> {
    return;
  }

  public async wipe(): Promise<void> {
    return;
  }

  public async btcGetAddress(msg: core.BTCGetAddress): Promise<string> {
    await this.validateCurrentApp(msg.coin);
    return btc.btcGetAddress(this.transport, msg);
  }

  public async btcSignTx(msg: core.BTCSignTxLedger): Promise<core.BTCSignedTx> {
    await this.validateCurrentApp(msg.coin);
    return btc.btcSignTx(this, this.transport, msg);
  }

  public async btcSignMessage(msg: core.BTCSignMessage): Promise<core.BTCSignedMessage> {
    await this.validateCurrentApp(msg.coin);
    return btc.btcSignMessage(this, this.transport, msg);
  }

  public async btcVerifyMessage(msg: core.BTCVerifyMessage): Promise<boolean> {
    return btc.btcVerifyMessage(msg);
  }

  public async ethSignTx(msg: core.ETHSignTx): Promise<core.ETHSignedTx> {
    await this.validateCurrentApp("Ethereum");
    return eth.ethSignTx(this.transport, msg);
  }

  public async ethGetAddress(msg: core.ETHGetAddress): Promise<string> {
    await this.validateCurrentApp("Ethereum");
    return eth.ethGetAddress(this.transport, msg);
  }

  public async ethSignMessage(msg: core.ETHSignMessage): Promise<core.ETHSignedMessage> {
    await this.validateCurrentApp("Ethereum");
    return eth.ethSignMessage(this.transport, msg);
  }

  public async ethSignTypedData(msg: core.ETHSignTypedData): Promise<core.ETHSignedTypedData | null> {
    await this.validateCurrentApp("Ethereum");
    return eth.ethSignTypedData(this.transport, msg);
  }

  public async ethVerifyMessage(msg: core.ETHVerifyMessage): Promise<boolean> {
    return eth.ethVerifyMessage(msg);
  }

  public thorchainGetAddress(msg: core.ThorchainGetAddress): Promise<string> {
    return thorchain.thorchainGetAddress(this.transport, msg);
  }

  public thorchainSignTx(msg: core.ThorchainSignTx): Promise<core.ThorchainSignedTx> {
    return thorchain.thorchainSignTx(this.transport, msg);
  }

  public cosmosGetAddress(msg: core.CosmosGetAddress): Promise<string> {
    return cosmos.cosmosGetAddress(this.transport, msg);
  }

  public cosmosSignTx(msg: core.CosmosSignTx): Promise<core.CosmosSignedTx> {
    return cosmos.cosmosSignTx(this.transport, msg);
  }

  public async solanaGetAddress(msg: core.SolanaGetAddress): Promise<string> {
    await this.validateCurrentApp("Solana");
    return solana.solanaGetAddress(this.transport, msg);
  }

  public async solanaSignTx(msg: core.SolanaSignTx): Promise<core.SolanaSignedTx | null> {
    await this.validateCurrentApp("Solana");
    return solana.solanaSignTx(this.transport, msg);
  }

  public disconnect(): Promise<void> {
    return this.transport.disconnect();
  }
}

export function info(): LedgerHDWalletInfo {
  return new LedgerHDWalletInfo();
}

export function create(transport: LedgerTransport): LedgerHDWallet {
  return new LedgerHDWallet(transport);
}
