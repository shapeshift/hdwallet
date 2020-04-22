import {
  HDWallet,
  GetPublicKey,
  PublicKey,
  RecoverDevice,
  ResetDevice,
  LoadDevice,
  Coin,
  Ping,
  Pong,
  BTCWallet,
  ETHWallet,
  Constructor,
  ActionCancelled,
  DeviceDisconnected,
  PopupClosedError,
  BTCInputScriptType,
  BTCGetAddress,
  BTCSignTx,
  BTCSignedTx,
  BTCSignMessage,
  BTCVerifyMessage,
  BTCAccountPath,
  BTCSignedMessage,
  BTCGetAccountPaths,
  ETHSignTx,
  ETHSignedTx,
  ETHGetAddress,
  ETHSignMessage,
  ETHSignedMessage,
  ETHVerifyMessage,
  ETHGetAccountPath,
  ETHAccountPath,
  HDWalletInfo,
  BTCWalletInfo,
  ETHWalletInfo,
  slip44ByCoin,
  BIP32Path,
  DescribePath,
  PathDescription,
  addressNListToBIP32,
  hardenedPath,
  relativePath,
} from "@shapeshiftoss/hdwallet-core";
import { handleError } from "./utils";
import * as Btc from "./bitcoin";
import * as Eth from "./ethereum";
import { TrezorTransport } from "./transport";
import { isObject } from "lodash";

export function isTrezor(wallet: HDWallet): wallet is TrezorHDWallet {
  return isObject(wallet) && (wallet as any)._isTrezor;
}

function describeETHPath(path: BIP32Path): PathDescription {
  let pathStr = addressNListToBIP32(path);
  let unknown: PathDescription = {
    verbose: pathStr,
    coin: "Ethereum",
    isKnown: false,
  };

  if (path.length != 5) return unknown;

  if (path[0] != 0x80000000 + 44) return unknown;

  if (path[1] != 0x80000000 + slip44ByCoin("Ethereum")) return unknown;

  if (path[2] !== 0x80000000) return unknown;

  if (path[3] != 0) return unknown;

  if ((path[4] & 0x80000000) !== 0) return unknown;

  let accountIdx = path[4] & 0x7fffffff;
  return {
    verbose: `Ethereum Account #${accountIdx}`,
    coin: "Ethereum",
    accountIdx,
    wholeAccount: true,
    isKnown: true,
    isPrefork: false,
  };
}

function describeUTXOPath(
  path: BIP32Path,
  coin: Coin,
  scriptType: BTCInputScriptType
) {
  let pathStr = addressNListToBIP32(path);
  let unknown: PathDescription = {
    verbose: pathStr,
    coin,
    scriptType,
    isKnown: false,
  };

  if (!Btc.btcSupportsCoin(coin)) return unknown;

  if (!Btc.btcSupportsScriptType(coin, scriptType)) return unknown;

  if (path.length !== 3 && path.length !== 5) return unknown;

  if ((path[0] & 0x80000000) >>> 0 !== 0x80000000) return unknown;

  let purpose = path[0] & 0x7fffffff;

  if (![44, 49, 84].includes(purpose)) return unknown;

  if (purpose === 44 && scriptType !== BTCInputScriptType.SpendAddress)
    return unknown;

  if (purpose === 49 && scriptType !== BTCInputScriptType.SpendP2SHWitness)
    return unknown;

  if (purpose === 84 && scriptType !== BTCInputScriptType.SpendWitness)
    return unknown;

  if (path[1] !== 0x80000000 + slip44ByCoin(coin)) return unknown;

  let wholeAccount = path.length === 3;

  let script = {
    [BTCInputScriptType.SpendAddress]: " (Legacy)",
    [BTCInputScriptType.SpendP2SHWitness]: "",
    [BTCInputScriptType.SpendWitness]: " (Segwit Native)",
  }[scriptType];

  switch (coin) {
    case "Bitcoin":
    case "Litecoin":
    case "BitcoinGold":
    case "Testnet":
      break;
    default:
      script = "";
  }

  let accountIdx = path[2] & 0x7fffffff;

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
    let change = path[3] === 1 ? "Change " : "";
    let addressIdx = path[4];
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

export class TrezorHDWalletInfo
  implements HDWalletInfo, BTCWalletInfo, ETHWalletInfo {
  _supportsBTCInfo: boolean = true;
  _supportsETHInfo: boolean = true;
  _supportsCosmosInfo: boolean = false;
  _supportsEosInfo: boolean = false;

  public getVendor(): string {
    return "Trezor";
  }

  public async btcSupportsCoin(coin: Coin): Promise<boolean> {
    return Btc.btcSupportsCoin(coin);
  }

  public async btcSupportsScriptType(
    coin: Coin,
    scriptType: BTCInputScriptType
  ): Promise<boolean> {
    return Btc.btcSupportsScriptType(coin, scriptType);
  }

  public async btcSupportsSecureTransfer(): Promise<boolean> {
    return Btc.btcSupportsSecureTransfer();
  }

  public btcSupportsNativeShapeShift(): boolean {
    return Btc.btcSupportsNativeShapeShift();
  }

  public btcGetAccountPaths(msg: BTCGetAccountPaths): Array<BTCAccountPath> {
    return Btc.btcGetAccountPaths(msg);
  }

  public btcIsSameAccount(msg: Array<BTCAccountPath>): boolean {
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

  public ethGetAccountPaths(msg: ETHGetAccountPath): Array<ETHAccountPath> {
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

  public hasNativeShapeShift(srcCoin: Coin, dstCoin: Coin): boolean {
    // It doesn't... yet?
    return false;
  }

  public describePath(msg: DescribePath): PathDescription {
    switch (msg.coin) {
      case "Ethereum":
        return describeETHPath(msg.path);
      default:
        return describeUTXOPath(msg.path, msg.coin, msg.scriptType);
    }
  }

  public btcNextAccountPath(msg: BTCAccountPath): BTCAccountPath | undefined {
    let description = describeUTXOPath(
      msg.addressNList,
      msg.coin,
      msg.scriptType
    );
    if (!description.isKnown) {
      return undefined;
    }

    let addressNList = msg.addressNList;

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

  public ethNextAccountPath(msg: ETHAccountPath): ETHAccountPath | undefined {
    let addressNList = msg.hardenedPath.concat(msg.relPath);
    let description = describeETHPath(addressNList);
    if (!description.isKnown) {
      return undefined;
    }

    if (addressNList[0] === 0x80000000 + 44) {
      addressNList[4] += 1;
      return {
        ...msg,
        addressNList,
        hardenedPath: hardenedPath(addressNList),
        relPath: relativePath(addressNList),
      };
    }

    return undefined;
  }
}

export class TrezorHDWallet implements HDWallet, BTCWallet, ETHWallet {
  _supportsETHInfo: boolean = true;
  _supportsBTCInfo: boolean = true;
  _supportsDebugLink: boolean = false;
  _supportsBTC: boolean = true;
  _supportsETH: boolean = true;
  _supportsCosmosInfo: boolean = false;
  _supportsCosmos: boolean = false;
  _supportsEosInfo: boolean = false;
  _supportsEos: boolean = false;
  _isTrezor: boolean = true;

  transport: TrezorTransport;
  featuresCache: any;
  info: TrezorHDWalletInfo & HDWalletInfo;

  constructor(transport: TrezorTransport) {
    this.transport = transport;
    this.info = new TrezorHDWalletInfo();
  }

  public async initialize(): Promise<any> {
    return;
  }

  public async isInitialized(): Promise<boolean> {
    let features = await this.getFeatures(/*cached*/ true);
    return features.initialized;
  }

  public async getDeviceID(): Promise<string> {
    const {
      device: { deviceID: transportId },
    } = this.transport as any;
    if (transportId) return transportId;

    let features = await this.getFeatures(/*cached*/ true);
    return features.device_id;
  }

  public async getFirmwareVersion(): Promise<string> {
    let features = await this.getFeatures(/*cached*/ true);
    return `v${features.major_version}.${features.minor_version}.${features.patch_version}`;
  }

  public getVendor(): string {
    return "Trezor";
  }

  public async getModel(): Promise<string> {
    let features = await this.getFeatures(/*cached*/ true);
    return "Trezor " + features.model;
  }

  public async getLabel(): Promise<string> {
    let features = await this.getFeatures(/*cached*/ true);
    return features.label;
  }

  public async getFeatures(cached: boolean = false): Promise<any> {
    if (cached && this.featuresCache) return this.featuresCache;
    let res = await this.transport.call("getFeatures", {});
    handleError(this.transport, res, "Could not get Trezor features");
    this.cacheFeatures(res.payload);
    return res.payload;
  }

  public cacheFeatures(features: any): void {
    this.featuresCache = features;
  }

  public async getPublicKeys(
    msg: Array<GetPublicKey>
  ): Promise<Array<PublicKey | null>> {
    if (!msg.length) return [];
    let res = await this.transport.call("getPublicKey", {
      bundle: msg.map((request) => {
        return {
          path: request.addressNList,
          coin: request.coin || "Bitcoin",
          crossChain: true,
        };
      }),
    });
    handleError(this.transport, res, "Could not load xpubs from Trezor");
    return res.payload.map((result, i) => {
      const scriptType = msg[i].scriptType;
      switch (scriptType) {
        case BTCInputScriptType.SpendP2SHWitness:
        case BTCInputScriptType.SpendWitness:
          return {
            xpub: result.xpubSegwit,
          };
        case BTCInputScriptType.SpendAddress:
        default:
          return {
            xpub: result.xpub,
          };
      }
    });
  }

  public async isLocked(): Promise<boolean> {
    const features = await this.getFeatures(false);
    if (features.pin_protection && !features.pin_cached) return true;
    if (features.passphrase_protection && !features.passphrase_cached)
      return true;
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

  public async sendCharacter(charater: string): Promise<void> {
    throw new Error("Trezor does not suport chiphered recovery");
  }

  public async sendWord(word: string): Promise<void> {
    throw new Error("Trezor does not yet support recoverDevice");
  }

  public async ping(msg: Ping): Promise<Pong> {
    // TrezorConnect doesn't expose the device's normal 'Ping' message, so we
    // have to fake it here:
    return { msg: msg.msg };
  }

  public async wipe(): Promise<void> {
    let res = await this.transport.call("wipeDevice", {});
    handleError(this.transport, res, "Could not wipe Trezor");
  }

  public async reset(msg: ResetDevice): Promise<void> {
    let res = await this.transport.call("resetDevice", {
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

  public async recover(msg: RecoverDevice): Promise<void> {
    // https://github.com/trezor/connect/pull/320
    throw new Error("TrezorConnect does not expose RecoverDevice... yet?");
  }

  public async loadDevice(msg: LoadDevice): Promise<void> {
    // https://github.com/trezor/connect/issues/363
    let res = await this.transport.call("loadDevice", {
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

  public hasNativeShapeShift(srcCoin: Coin, dstCoin: Coin): boolean {
    // It doesn't... yet?
    return false;
  }

  public async btcSupportsCoin(coin: Coin): Promise<boolean> {
    return this.info.btcSupportsCoin(coin);
  }

  public async btcSupportsScriptType(
    coin: Coin,
    scriptType: BTCInputScriptType
  ): Promise<boolean> {
    return this.info.btcSupportsScriptType(coin, scriptType);
  }

  public async btcGetAddress(msg: BTCGetAddress): Promise<string> {
    return Btc.btcGetAddress(this.transport, msg);
  }

  public async btcSignTx(msg: BTCSignTx): Promise<BTCSignedTx> {
    return Btc.btcSignTx(this, this.transport, msg);
  }

  public async btcSupportsSecureTransfer(): Promise<boolean> {
    return this.info.btcSupportsSecureTransfer();
  }

  public btcSupportsNativeShapeShift(): boolean {
    return this.info.btcSupportsNativeShapeShift();
  }

  public async btcSignMessage(msg: BTCSignMessage): Promise<BTCSignedMessage> {
    return Btc.btcSignMessage(this.transport, msg);
  }

  public async btcVerifyMessage(msg: BTCVerifyMessage): Promise<boolean> {
    return Btc.btcVerifyMessage(this.transport, msg);
  }

  public btcGetAccountPaths(msg: BTCGetAccountPaths): Array<BTCAccountPath> {
    return Btc.btcGetAccountPaths(msg);
  }

  public btcIsSameAccount(msg: Array<BTCAccountPath>): boolean {
    return this.info.btcIsSameAccount(msg);
  }

  public async ethSignTx(msg: ETHSignTx): Promise<ETHSignedTx> {
    return Eth.ethSignTx(this, this.transport, msg);
  }

  public async ethGetAddress(msg: ETHGetAddress): Promise<string> {
    return Eth.ethGetAddress(this.transport, msg);
  }

  public async ethSignMessage(msg: ETHSignMessage): Promise<ETHSignedMessage> {
    return Eth.ethSignMessage(this.transport, msg);
  }

  public async ethVerifyMessage(msg: ETHVerifyMessage): Promise<boolean> {
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

  public ethGetAccountPaths(msg: ETHGetAccountPath): Array<ETHAccountPath> {
    return this.info.ethGetAccountPaths(msg);
  }

  public describePath(msg: DescribePath): PathDescription {
    return this.info.describePath(msg);
  }

  public disconnect(): Promise<void> {
    return this.transport.disconnect();
  }

  public btcNextAccountPath(msg: BTCAccountPath): BTCAccountPath | undefined {
    return this.info.btcNextAccountPath(msg);
  }

  public ethNextAccountPath(msg: ETHAccountPath): ETHAccountPath | undefined {
    return this.info.ethNextAccountPath(msg);
  }
}

export function info(): TrezorHDWalletInfo {
  return new TrezorHDWalletInfo();
}

export function create(
  transport: TrezorTransport,
  debuglink: boolean
): TrezorHDWallet {
  return new TrezorHDWallet(transport);
}
