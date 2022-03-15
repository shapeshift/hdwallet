import * as core from "@shapeshiftoss/hdwallet-core";
import _ from "lodash";

import * as Btc from "./bitcoin";
import * as Eth from "./ethereum";
import { TrezorTransport } from "./transport";
import { handleError } from "./utils";

export function isTrezor(wallet: core.HDWallet): wallet is TrezorHDWallet {
  return _.isObject(wallet) && (wallet as any)._isTrezor;
}

function describeETHPath(path: core.BIP32Path): core.PathDescription {
  const pathStr = core.addressNListToBIP32(path);
  const unknown: core.PathDescription = {
    verbose: pathStr,
    coin: "Ethereum",
    isKnown: false,
  };

  if (path.length != 5) return unknown;

  if (path[0] != 0x80000000 + 44) return unknown;

  if (path[1] != 0x80000000 + core.slip44ByCoin("Ethereum")) return unknown;

  if (path[2] !== 0x80000000) return unknown;

  if (path[3] != 0) return unknown;

  if ((path[4] & 0x80000000) !== 0) return unknown;

  const accountIdx = path[4] & 0x7fffffff;
  return {
    verbose: `Ethereum Account #${accountIdx}`,
    coin: "Ethereum",
    accountIdx,
    wholeAccount: true,
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

  if (!Btc.btcSupportsCoin(coin)) return unknown;

  if (!Btc.btcSupportsScriptType(coin, scriptType)) return unknown;

  if (path.length !== 3 && path.length !== 5) return unknown;

  if ((path[0] & 0x80000000) >>> 0 !== 0x80000000) return unknown;

  const purpose = path[0] & 0x7fffffff;

  if (![44, 49, 84].includes(purpose)) return unknown;

  if (purpose === 44 && scriptType !== core.BTCInputScriptType.SpendAddress) return unknown;

  if (purpose === 49 && scriptType !== core.BTCInputScriptType.SpendP2SHWitness) return unknown;

  if (purpose === 84 && scriptType !== core.BTCInputScriptType.SpendWitness) return unknown;

  const slip44 = core.slip44ByCoin(coin);
  if (slip44 == undefined || path[1] !== 0x80000000 + slip44) return unknown;

  const wholeAccount = path.length === 3;

  let script = scriptType
    ? (
        {
          [core.BTCInputScriptType.SpendAddress]: " (Legacy)",
          [core.BTCInputScriptType.SpendP2SHWitness]: "",
          [core.BTCInputScriptType.SpendWitness]: " (Segwit Native)",
        } as Partial<Record<core.BTCInputScriptType, string>>
      )[scriptType] ?? ""
    : "";

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
      scriptType,
      coin,
      accountIdx,
      wholeAccount: true,
      isKnown: true,
      isPrefork: false,
    };
  } else {
    const change = path[3] === 1 ? "Change " : "";
    const addressIdx = path[4];
    return {
      verbose: `${coin} Account #${accountIdx}, ${change}Address #${addressIdx}${script}`,
      coin,
      scriptType,
      accountIdx,
      addressIdx,
      isChange: path[3] === 1,
      wholeAccount: false,
      isKnown: true,
      isPrefork: false,
    };
  }
}

export class TrezorHDWalletInfo implements core.HDWalletInfo, core.BTCWalletInfo, core.ETHWalletInfo {
  readonly _supportsBTCInfo = true;
  readonly _supportsETHInfo = true;

  public getVendor(): string {
    return "Trezor";
  }

  public async btcSupportsCoin(coin: core.Coin): Promise<boolean> {
    return Btc.btcSupportsCoin(coin);
  }

  public async btcSupportsScriptType(coin: core.Coin, scriptType: core.BTCInputScriptType): Promise<boolean> {
    return Btc.btcSupportsScriptType(coin, scriptType);
  }

  public async btcSupportsSecureTransfer(): Promise<boolean> {
    return Btc.btcSupportsSecureTransfer();
  }

  public btcSupportsNativeShapeShift(): boolean {
    return Btc.btcSupportsNativeShapeShift();
  }

  public btcGetAccountPaths(msg: core.BTCGetAccountPaths): Array<core.BTCAccountPath> {
    return Btc.btcGetAccountPaths(msg);
  }

  public btcIsSameAccount(msg: Array<core.BTCAccountPath>): boolean {
    return Btc.btcIsSameAccount(msg);
  }

  public async ethSupportsNetwork(chain_id: number): Promise<boolean> {
    return Eth.ethSupportsNetwork(chain_id);
  }

  public async ethSupportsSecureTransfer(): Promise<boolean> {
    return Eth.ethSupportsSecureTransfer();
  }

  public ethSupportsNativeShapeShift(): boolean {
    return Eth.ethSupportsNativeShapeShift();
  }

  public async ethSupportsEIP1559(): Promise<boolean> {
    return await Eth.ethSupportsEIP1559();
  }

  public ethGetAccountPaths(msg: core.ETHGetAccountPath): Array<core.ETHAccountPath> {
    return Eth.ethGetAccountPaths(msg);
  }

  public hasOnDevicePinEntry(): boolean {
    return true;
  }

  public hasOnDevicePassphrase(): boolean {
    return true;
  }

  public hasOnDeviceDisplay(): boolean {
    return true;
  }

  public hasOnDeviceRecovery(): boolean {
    // Not really meaningful since TrezorConnect doesn't expose recovery yet
    return true;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public hasNativeShapeShift(srcCoin: core.Coin, dstCoin: core.Coin): boolean {
    return false;
  }

  public supportsOfflineSigning(): boolean {
    return true;
  }

  public supportsBroadcast(): boolean {
    return false;
  }

  public describePath(msg: core.DescribePath): core.PathDescription {
    switch (msg.coin) {
      case "Ethereum":
        return describeETHPath(msg.path);
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

    if (addressNList[0] === 0x80000000 + 44) {
      addressNList[4] += 1;
      return {
        ...msg,
        addressNList,
        hardenedPath: core.hardenedPath(addressNList),
        relPath: core.relativePath(addressNList),
      };
    }

    return undefined;
  }
}

export class TrezorHDWallet implements core.HDWallet, core.BTCWallet, core.ETHWallet {
  readonly _supportsETHInfo = true;
  readonly _supportsBTCInfo = true;
  readonly _supportsBTC = true;
  readonly _supportsETH = true;
  readonly _supportsKavaInfo = true;
  readonly _supportsTerraInfo = true;
  readonly _isTrezor = true;

  transport: TrezorTransport;
  featuresCache: any;
  info: TrezorHDWalletInfo & core.HDWalletInfo;

  constructor(transport: TrezorTransport) {
    this.transport = transport;
    this.info = new TrezorHDWalletInfo();
  }

  public async initialize(): Promise<any> {
    return;
  }

  public async isInitialized(): Promise<boolean> {
    const features = await this.getFeatures(/*cached*/ true);
    return features.initialized;
  }

  public async getDeviceID(): Promise<string> {
    const {
      device: { deviceID: transportId },
    } = this.transport as any;
    if (transportId) return transportId;

    const features = await this.getFeatures(/*cached*/ true);
    return features.device_id;
  }

  public async getFirmwareVersion(): Promise<string> {
    const features = await this.getFeatures(/*cached*/ true);
    return `v${features.major_version}.${features.minor_version}.${features.patch_version}`;
  }

  public getVendor(): string {
    return "Trezor";
  }

  public async getModel(): Promise<string> {
    const features = await this.getFeatures(/*cached*/ true);
    return "Trezor " + features.model;
  }

  public async getLabel(): Promise<string> {
    const features = await this.getFeatures(/*cached*/ true);
    return typeof features.label === "string" ? features.label : "";
  }

  public async getFeatures(cached = false): Promise<any> {
    if (cached && this.featuresCache) return this.featuresCache;
    const res = await this.transport.call("getFeatures", {});
    handleError(this.transport, res, "Could not get Trezor features");
    this.cacheFeatures(res.payload);
    return res.payload;
  }

  public cacheFeatures(features: any): void {
    this.featuresCache = features;
  }

  public async getPublicKeys(msg: Array<core.GetPublicKey>): Promise<Array<core.PublicKey | null>> {
    if (!msg.length) return [];
    const res = await this.transport.call("getPublicKey", {
      bundle: msg.map((request) => {
        return {
          path: request.addressNList,
          coin: request.coin || "Bitcoin",
          crossChain: true,
        };
      }),
    });
    handleError(this.transport, res, "Could not load xpubs from Trezor");
    return (res.payload as Array<{ xpubSegwit?: string; xpub?: string }>).map((result, i) => {
      const scriptType = msg[i].scriptType;
      switch (scriptType) {
        case core.BTCInputScriptType.SpendP2SHWitness:
        case core.BTCInputScriptType.SpendWitness: {
          const xpub = result.xpubSegwit;
          if (!xpub) throw new Error("unable to get public key");
          return {
            xpub,
          };
        }
        case core.BTCInputScriptType.SpendAddress:
        default: {
          const xpub = result.xpub;
          if (!xpub) throw new Error("unable to get public key");
          return {
            xpub,
          };
        }
      }
    });
  }

  public async isLocked(): Promise<boolean> {
    const features = await this.getFeatures(false);
    if (features.pin_protection && !features.pin_cached) return true;
    if (features.passphrase_protection && !features.passphrase_cached) return true;
    return false;
  }

  public async clearSession(): Promise<void> {
    // TrezorConnect doesn't expose session management, so this is a no-op.
  }

  public async sendPin(pin: string): Promise<void> {
    await this.transport.call("uiResponse", {
      type: "ui-receive_pin",
      payload: pin,
    });
  }

  public async sendPassphrase(passphrase: string): Promise<void> {
    await this.transport.call("uiResponse", {
      type: "ui-receive_passphrase",
      payload: {
        value: passphrase,
        save: true,
      },
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async sendCharacter(charater: string): Promise<void> {
    throw new Error("Trezor does not suport chiphered recovery");
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async sendWord(word: string): Promise<void> {
    throw new Error("Trezor does not yet support recoverDevice");
  }

  public async ping(msg: core.Ping): Promise<core.Pong> {
    // TrezorConnect doesn't expose the device's normal 'Core.Ping' message, so we
    // have to fake it here:
    return { msg: msg.msg };
  }

  public async wipe(): Promise<void> {
    const res = await this.transport.call("wipeDevice", {});
    handleError(this.transport, res, "Could not wipe Trezor");
  }

  public async reset(msg: core.ResetDevice): Promise<void> {
    const res = await this.transport.call("resetDevice", {
      strength: msg.entropy,
      label: msg.label,
      pinProtection: msg.pin,
      passphraseProtection: msg.passphrase,
    });
    handleError(this.transport, res, "Could not reset Trezor");
  }

  public async cancel(): Promise<void> {
    await this.transport.cancel();
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async recover(msg: core.RecoverDevice): Promise<void> {
    // https://github.com/trezor/connect/pull/320
    throw new Error("TrezorConnect does not expose Core.RecoverDevice... yet?");
  }

  public async loadDevice(msg: core.LoadDevice): Promise<void> {
    // https://github.com/trezor/connect/issues/363
    const res = await this.transport.call("loadDevice", {
      mnemonic: msg.mnemonic,
      pin: msg.pin,
      passphraseProtection: msg.passphrase,
      label: msg.label,
    });
    handleError(this.transport, res, "Could not load seed into Trezor");
  }

  public hasOnDevicePinEntry(): boolean {
    return this.transport.hasPopup;
  }

  public hasOnDevicePassphrase(): boolean {
    return this.transport.hasPopup;
  }

  public hasOnDeviceDisplay(): boolean {
    return true;
  }

  public hasOnDeviceRecovery(): boolean {
    // Not really meaningful since TrezorConnect doesn't expose recovery yet
    return this.transport.hasPopup;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public hasNativeShapeShift(srcCoin: core.Coin, dstCoin: core.Coin): boolean {
    return false;
  }

  public supportsOfflineSigning(): boolean {
    return true;
  }

  public supportsBroadcast(): boolean {
    return false;
  }

  public async btcSupportsCoin(coin: core.Coin): Promise<boolean> {
    return this.info.btcSupportsCoin(coin);
  }

  public async btcSupportsScriptType(coin: core.Coin, scriptType: core.BTCInputScriptType): Promise<boolean> {
    return this.info.btcSupportsScriptType(coin, scriptType);
  }

  public async btcGetAddress(msg: core.BTCGetAddress): Promise<string> {
    return Btc.btcGetAddress(this.transport, msg);
  }

  public async btcSignTx(msg: core.BTCSignTxTrezor): Promise<core.BTCSignedTx> {
    return Btc.btcSignTx(this, this.transport, msg);
  }

  public async btcSupportsSecureTransfer(): Promise<boolean> {
    return this.info.btcSupportsSecureTransfer();
  }

  public btcSupportsNativeShapeShift(): boolean {
    return this.info.btcSupportsNativeShapeShift();
  }

  public async btcSignMessage(msg: core.BTCSignMessage): Promise<core.BTCSignedMessage> {
    return Btc.btcSignMessage(this.transport, msg);
  }

  public async btcVerifyMessage(msg: core.BTCVerifyMessage): Promise<boolean> {
    return Btc.btcVerifyMessage(this.transport, msg);
  }

  public btcGetAccountPaths(msg: core.BTCGetAccountPaths): Array<core.BTCAccountPath> {
    return Btc.btcGetAccountPaths(msg);
  }

  public btcIsSameAccount(msg: Array<core.BTCAccountPath>): boolean {
    return this.info.btcIsSameAccount(msg);
  }

  public async ethSignTx(msg: core.ETHSignTx): Promise<core.ETHSignedTx> {
    return Eth.ethSignTx(this, this.transport, msg);
  }

  public async ethGetAddress(msg: core.ETHGetAddress): Promise<string> {
    return Eth.ethGetAddress(this.transport, msg);
  }

  public async ethSignMessage(msg: core.ETHSignMessage): Promise<core.ETHSignedMessage> {
    return Eth.ethSignMessage(this.transport, msg);
  }

  public async ethVerifyMessage(msg: core.ETHVerifyMessage): Promise<boolean> {
    return Eth.ethVerifyMessage(this.transport, msg);
  }

  public async ethSupportsNetwork(chain_id: number): Promise<boolean> {
    return this.info.ethSupportsNetwork(chain_id);
  }

  public async ethSupportsSecureTransfer(): Promise<boolean> {
    return this.info.ethSupportsSecureTransfer();
  }

  public ethSupportsNativeShapeShift(): boolean {
    return this.info.ethSupportsNativeShapeShift();
  }

  public async ethSupportsEIP1559(): Promise<boolean> {
    return await this.info.ethSupportsEIP1559();
  }

  public ethGetAccountPaths(msg: core.ETHGetAccountPath): Array<core.ETHAccountPath> {
    return this.info.ethGetAccountPaths(msg);
  }

  public describePath(msg: core.DescribePath): core.PathDescription {
    return this.info.describePath(msg);
  }

  public disconnect(): Promise<void> {
    return this.transport.disconnect();
  }

  public btcNextAccountPath(msg: core.BTCAccountPath): core.BTCAccountPath | undefined {
    return this.info.btcNextAccountPath(msg);
  }

  public ethNextAccountPath(msg: core.ETHAccountPath): core.ETHAccountPath | undefined {
    return this.info.ethNextAccountPath(msg);
  }
}

export function info(): TrezorHDWalletInfo {
  return new TrezorHDWalletInfo();
}

export function create(transport: TrezorTransport): TrezorHDWallet {
  return new TrezorHDWallet(transport);
}
