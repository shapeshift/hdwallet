import * as Messages from "@keepkey/device-protocol/lib/messages_pb";
import * as Types from "@keepkey/device-protocol/lib/types_pb";
import * as core from "@shapeshiftoss/hdwallet-core";
import _ from "lodash";
import semver from "semver";

import * as Binance from "./binance";
import * as Btc from "./bitcoin";
import * as Cosmos from "./cosmos";
import * as Eos from "./eos";
import * as Eth from "./ethereum";
import * as Ripple from "./ripple";
import * as Thorchain from "./thorchain";
import { Transport } from "./transport";
import { messageTypeRegistry } from "./typeRegistry";
import { protoFieldToSetMethod, translateInputScriptType } from "./utils";

export function isKeepKey(wallet: core.HDWallet): wallet is KeepKeyHDWallet {
  return _.isObject(wallet) && (wallet as any)._isKeepKey;
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

  if ((path[2] & 0x80000000) >>> 0 !== 0x80000000) return unknown;

  if (path[3] != 0) return unknown;

  if (path[4] != 0) return unknown;

  const index = path[2] & 0x7fffffff;
  return {
    verbose: `Ethereum Account #${index}`,
    accountIdx: index,
    wholeAccount: true,
    coin: "Ethereum",
    isKnown: true,
    isPrefork: false,
  };
}

function describeUTXOPath(
  path: core.BIP32Path,
  coin: core.Coin,
  scriptType?: core.BTCInputScriptType
): core.PathDescription {
  const pathStr = core.addressNListToBIP32(path);
  const unknown: core.PathDescription = {
    verbose: pathStr,
    coin,
    scriptType,
    isKnown: false,
  };
  if (!scriptType) return unknown;

  if (!Btc.btcSupportsCoin(coin)) return unknown;

  if (!Btc.btcSupportsScriptType(coin, scriptType)) return unknown;

  if (path.length !== 3 && path.length !== 5) return unknown;

  if ((path[0] & 0x80000000) >>> 0 !== 0x80000000) return unknown;

  const purpose = path[0] & 0x7fffffff;

  if (![44, 49, 84].includes(purpose)) return unknown;

  if (purpose === 44 && scriptType !== core.BTCInputScriptType.SpendAddress) return unknown;

  if (purpose === 49 && scriptType !== core.BTCInputScriptType.SpendP2SHWitness) return unknown;

  if (purpose === 84 && scriptType !== core.BTCInputScriptType.SpendWitness) return unknown;

  const wholeAccount = path.length === 3;

  const script = scriptType
    ? (
        {
          [core.BTCInputScriptType.SpendAddress]: ["Legacy"],
          [core.BTCInputScriptType.SpendP2SHWitness]: [],
          [core.BTCInputScriptType.SpendWitness]: ["Segwit Native"],
        } as Partial<Record<core.BTCInputScriptType, string[]>>
      )[scriptType] ?? []
    : [];

  let isPrefork = false;
  const slip44 = core.slip44ByCoin(coin);
  if (slip44 === undefined) return unknown;
  if (path[1] !== 0x80000000 + slip44) {
    switch (coin) {
      case "BitcoinCash":
      case "BitcoinGold": {
        if (path[1] === 0x80000000 + core.slip44ByCoin("Bitcoin")) {
          isPrefork = true;
          break;
        }
        return unknown;
      }
      case "BitcoinSV": {
        if (
          path[1] === 0x80000000 + core.slip44ByCoin("Bitcoin") ||
          path[1] === 0x80000000 + core.slip44ByCoin("BitcoinCash")
        ) {
          isPrefork = true;
          break;
        }
        return unknown;
      }
      default:
        return unknown;
    }
  }

  let attributes = isPrefork ? ["Prefork"] : [];
  switch (coin) {
    case "Bitcoin":
    case "Litecoin":
    case "BitcoinGold":
    case "Testnet": {
      attributes = attributes.concat(script);
      break;
    }
    default:
      break;
  }

  const attr = attributes.length ? ` (${attributes.join(", ")})` : "";

  const accountIdx = path[2] & 0x7fffffff;

  if (wholeAccount) {
    return {
      coin,
      verbose: `${coin} Account #${accountIdx}${attr}`,
      accountIdx,
      wholeAccount: true,
      isKnown: true,
      scriptType,
      isPrefork,
    };
  } else {
    const change = path[3] === 1 ? "Change " : "";
    const addressIdx = path[4];
    return {
      coin,
      verbose: `${coin} Account #${accountIdx}, ${change}Address #${addressIdx}${attr}`,
      accountIdx,
      addressIdx,
      wholeAccount: false,
      isKnown: true,
      isChange: path[3] === 1,
      scriptType,
      isPrefork,
    };
  }
}

function describeCosmosPath(path: core.BIP32Path): core.PathDescription {
  const pathStr = core.addressNListToBIP32(path);
  const unknown: core.PathDescription = {
    verbose: pathStr,
    coin: "Atom",
    isKnown: false,
  };

  if (path.length != 5) {
    return unknown;
  }

  if (path[0] != 0x80000000 + 44) {
    return unknown;
  }

  if (path[1] != 0x80000000 + core.slip44ByCoin("Atom")) {
    return unknown;
  }

  if ((path[2] & 0x80000000) >>> 0 !== 0x80000000) {
    return unknown;
  }

  if (path[3] !== 0 || path[4] !== 0) {
    return unknown;
  }

  const index = path[2] & 0x7fffffff;
  return {
    verbose: `Cosmos Account #${index}`,
    accountIdx: index,
    wholeAccount: true,
    coin: "Atom",
    isKnown: true,
    isPrefork: false,
  };
}

function describeThorchainPath(path: core.BIP32Path): core.PathDescription {
  const pathStr = core.addressNListToBIP32(path);
  const unknown: core.PathDescription = {
    verbose: pathStr,
    coin: "Rune",
    isKnown: false,
  };

  if (path.length != 5) {
    return unknown;
  }

  if (path[0] != 0x80000000 + 44) {
    return unknown;
  }

  if (path[1] != 0x80000000 + core.slip44ByCoin("Rune")) {
    return unknown;
  }

  if ((path[2] & 0x80000000) >>> 0 !== 0x80000000) {
    return unknown;
  }

  if (path[3] !== 0 || path[4] !== 0) {
    return unknown;
  }

  const index = path[2] & 0x7fffffff;
  return {
    verbose: `THORChain Account #${index}`,
    accountIdx: index,
    wholeAccount: true,
    coin: "Rune",
    isKnown: true,
    isPrefork: false,
  };
}

function describeEosPath(path: core.BIP32Path): core.PathDescription {
  const pathStr = core.addressNListToBIP32(path);
  const unknown: core.PathDescription = {
    verbose: pathStr,
    coin: "Eos",
    isKnown: false,
  };

  if (path.length != 5) {
    return unknown;
  }

  if (path[0] != 0x80000000 + 44) {
    return unknown;
  }

  if (path[1] != 0x80000000 + core.slip44ByCoin("Eos")) {
    return unknown;
  }

  if ((path[2] & 0x80000000) >>> 0 !== 0x80000000) {
    return unknown;
  }

  if (path[3] !== 0 || path[4] !== 0) {
    return unknown;
  }

  const index = path[2] & 0x7fffffff;
  return {
    verbose: `Eos Account #${index}`,
    accountIdx: index,
    wholeAccount: true,
    coin: "Eos",
    isKnown: true,
    isPrefork: false,
  };
}

function describeRipplePath(path: core.BIP32Path): core.PathDescription {
  const pathStr = core.addressNListToBIP32(path);
  const unknown: core.PathDescription = {
    verbose: pathStr,
    coin: "Ripple",
    isKnown: false,
  };

  if (path.length != 5) {
    return unknown;
  }

  if (path[0] != 0x80000000 + 44) {
    return unknown;
  }

  if (path[1] != 0x80000000 + core.slip44ByCoin("Ripple")) {
    return unknown;
  }

  if ((path[2] & 0x80000000) >>> 0 !== 0x80000000) {
    return unknown;
  }

  if (path[3] !== 0 || path[4] !== 0) {
    return unknown;
  }

  const index = path[2] & 0x7fffffff;
  return {
    verbose: `Ripple Account #${index}`,
    accountIdx: index,
    wholeAccount: true,
    coin: "Ripple",
    isKnown: true,
    isPrefork: false,
  };
}

function describeBinancePath(path: core.BIP32Path): core.PathDescription {
  const pathStr = core.addressNListToBIP32(path);
  const unknown: core.PathDescription = {
    verbose: pathStr,
    coin: "Binance",
    isKnown: false,
  };

  if (path.length != 5) {
    return unknown;
  }

  if (path[0] != 0x80000000 + 44) {
    return unknown;
  }

  if (path[1] != 0x80000000 + core.slip44ByCoin("Binance")) {
    return unknown;
  }

  if ((path[2] & 0x80000000) >>> 0 !== 0x80000000) {
    return unknown;
  }

  if (path[3] !== 0 || path[4] !== 0) {
    return unknown;
  }

  const index = path[2] & 0x7fffffff;
  return {
    verbose: `Binance Account #${index}`,
    accountIdx: index,
    wholeAccount: true,
    coin: "Binance",
    isKnown: true,
    isPrefork: false,
  };
}

export class KeepKeyHDWalletInfo
  implements
    core.HDWalletInfo,
    core.BTCWalletInfo,
    core.ETHWalletInfo,
    core.CosmosWalletInfo,
    core.BinanceWalletInfo,
    core.RippleWalletInfo,
    core.EosWalletInfo,
    core.ThorchainWalletInfo
{
  readonly _supportsBTCInfo = true;
  readonly _supportsETHInfo = true;
  readonly _supportsCosmosInfo = true;
  readonly _supportsOsmosisInfo = true;
  readonly _supportsRippleInfo = true;
  readonly _supportsBinanceInfo = true;
  readonly _supportsEosInfo = true;
  readonly _supportsThorchainInfo = true;

  public getVendor(): string {
    return "KeepKey";
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
    return true;
  }

  public ethGetAccountPaths(msg: core.ETHGetAccountPath): Array<core.ETHAccountPath> {
    return Eth.ethGetAccountPaths(msg);
  }

  public cosmosGetAccountPaths(msg: core.CosmosGetAccountPaths): Array<core.CosmosAccountPath> {
    return Cosmos.cosmosGetAccountPaths(msg);
  }

  public thorchainGetAccountPaths(msg: core.ThorchainGetAccountPaths): Array<core.ThorchainAccountPath> {
    return Thorchain.thorchainGetAccountPaths(msg);
  }

  public rippleGetAccountPaths(msg: core.RippleGetAccountPaths): Array<core.RippleAccountPath> {
    return Ripple.rippleGetAccountPaths(msg);
  }

  public binanceGetAccountPaths(msg: core.BinanceGetAccountPaths): Array<core.BinanceAccountPath> {
    return Binance.binanceGetAccountPaths(msg);
  }

  public eosGetAccountPaths(msg: core.EosGetAccountPaths): Array<core.EosAccountPath> {
    return Eos.eosGetAccountPaths(msg);
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
    return true;
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
      case "Atom":
        return describeCosmosPath(msg.path);
      case "Binance":
        return describeBinancePath(msg.path);
      case "Ripple":
        return describeRipplePath(msg.path);
      case "Eos":
        return describeEosPath(msg.path);
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
      addressNList[2] += 1;
      return {
        ...msg,
        addressNList,
        hardenedPath: core.hardenedPath(addressNList),
        relPath: core.relativePath(addressNList),
      };
    }

    return undefined;
  }

  public cosmosNextAccountPath(msg: core.CosmosAccountPath): core.CosmosAccountPath | undefined {
    const description = describeCosmosPath(msg.addressNList);
    if (!description.isKnown) {
      return undefined;
    }

    const addressNList = msg.addressNList;
    addressNList[2] += 1;

    return {
      ...msg,
      addressNList,
    };
  }

  public thorchainNextAccountPath(msg: core.ThorchainAccountPath): core.ThorchainAccountPath | undefined {
    const description = describeThorchainPath(msg.addressNList);
    if (!description.isKnown) {
      return undefined;
    }

    const addressNList = msg.addressNList;
    addressNList[2] += 1;

    return {
      ...msg,
      addressNList,
    };
  }

  public rippleNextAccountPath(msg: core.RippleAccountPath): core.RippleAccountPath | undefined {
    const description = describeRipplePath(msg.addressNList);
    if (!description.isKnown) {
      return undefined;
    }
    const addressNList = msg.addressNList;
    addressNList[2] += 1;

    return {
      ...msg,
      addressNList,
    };
  }

  public binanceNextAccountPath(msg: core.BinanceAccountPath): core.BinanceAccountPath | undefined {
    const description = describeBinancePath(msg.addressNList);
    if (!description.isKnown) {
      return undefined;
    }

    const addressNList = msg.addressNList;
    addressNList[2] += 1;

    return {
      ...msg,
      addressNList,
    };
  }

  public eosNextAccountPath(msg: core.EosAccountPath): core.EosAccountPath | undefined {
    const description = describeEosPath(msg.addressNList);
    if (!description.isKnown) {
      return undefined;
    }

    const addressNList = msg.addressNList;
    addressNList[2] += 1;

    return {
      ...msg,
      addressNList,
    };
  }
}

export class KeepKeyHDWallet implements core.HDWallet, core.BTCWallet, core.ETHWallet, core.DebugLinkWallet {
  readonly _supportsETHInfo = true;
  readonly _supportsBTCInfo = true;
  readonly _supportsCosmosInfo = true;
  readonly _supportsOsmosisInfo = true;
  readonly _supportsRippleInfo = true;
  readonly _supportsBinanceInfo = true;
  readonly _supportsEosInfo = true;
  readonly _supportsFioInfo = false;
  readonly _supportsDebugLink: boolean;
  readonly _isKeepKey = true;
  readonly _supportsETH = true;
  readonly _supportsBTC = true;
  _supportsCosmos = true;
  _supportsOsmosis = true;
  _supportsRipple = true;
  _supportsBinance = true;
  _supportsEos = true;
  readonly _supportsFio = false;
  readonly _supportsThorchainInfo = true;
  readonly _supportsThorchain = true;
  readonly _supportsSecretInfo = false;
  readonly _supportsSecret = false;
  readonly _supportsKava = false;
  readonly _supportsKavaInfo = false;
  readonly _supportsTerra = false;
  readonly _supportsTerraInfo = false;

  transport: Transport;
  features?: Messages.Features.AsObject;
  info: KeepKeyHDWalletInfo & core.HDWalletInfo;

  featuresCache?: Messages.Features.AsObject;

  constructor(transport: Transport) {
    this.transport = transport;
    this._supportsDebugLink = transport.debugLink;
    this.info = new KeepKeyHDWalletInfo();
  }

  static async create(transport: Transport): Promise<KeepKeyHDWallet> {
    return new KeepKeyHDWallet(transport);
  }

  public async getDeviceID(): Promise<string> {
    const featuresId = (await this.getFeatures(/*cached=*/ true)).deviceId;

    // Devices in bootloader mode show up with empty string deviceId's in their features object.
    if (featuresId) return featuresId;

    // Grabbing the one from the transport seems to be a reasonable fallback.
    return await this.transport.getDeviceID();
  }

  public getVendor(): string {
    return "KeepKey";
  }

  public async getModel(): Promise<string> {
    return core.mustBeDefined((await this.getFeatures(/*cached=*/ true)).model);
  }

  public async getFirmwareVersion(): Promise<string> {
    const features = await this.getFeatures(/*cached=*/ true);
    return `v${features.majorVersion}.${features.minorVersion}.${features.patchVersion}`;
  }

  public async getLabel(): Promise<string> {
    return (await this.getFeatures(/*cached=*/ true)).label ?? "";
  }

  public async isInitialized(): Promise<boolean> {
    return !!(await this.getFeatures()).initialized;
  }

  public async isLocked(): Promise<boolean> {
    const features = await this.getFeatures();
    if (features.pinProtection && !features.pinCached) return true;
    if (features.passphraseProtection && !features.passphraseCached) return true;
    return false;
  }

  public async getPublicKeys(getPublicKeys: Array<core.GetPublicKey>): Promise<Array<core.PublicKey | null>> {
    const publicKeys = [];
    for (let i = 0; i < getPublicKeys.length; i++) {
      const { coin, addressNList, curve, showDisplay, scriptType } = getPublicKeys[i];
      const GPK = new Messages.GetPublicKey();
      if (coin) GPK.setCoinName(coin);
      GPK.setAddressNList(addressNList);
      GPK.setShowDisplay(showDisplay || false);
      GPK.setEcdsaCurveName(curve || "secp256k1");
      GPK.setScriptType(translateInputScriptType(scriptType || core.BTCInputScriptType.SpendAddress));

      const event = await this.transport.call(Messages.MessageType.MESSAGETYPE_GETPUBLICKEY, GPK, {
        msgTimeout: showDisplay ? core.LONG_TIMEOUT : core.DEFAULT_TIMEOUT,
      });
      const publicKey = event.proto as Messages.PublicKey;

      publicKeys.push({ xpub: core.mustBeDefined(publicKey.getXpub()) });
    }
    return publicKeys;
  }

  public async ping(msg: core.Ping): Promise<core.Pong> {
    const ping = new Messages.Ping();
    ping.setMessage(msg.msg);
    ping.setButtonProtection(msg.button || false);
    ping.setPinProtection(msg.pin || false);
    ping.setPassphraseProtection(msg.passphrase || false);
    const event = await this.transport.call(Messages.MessageType.MESSAGETYPE_PING, ping, {
      msgTimeout: msg.button || msg.pin || msg.passphrase ? core.LONG_TIMEOUT : core.DEFAULT_TIMEOUT,
    });
    const message = event.proto as Messages.Success;
    return { msg: core.mustBeDefined(message.getMessage()) };
  }

  public async reset(msg: core.ResetDevice): Promise<void> {
    const resetDevice = new Messages.ResetDevice();
    resetDevice.setStrength(msg.entropy || 128);
    resetDevice.setDisplayRandom(false);
    resetDevice.setPassphraseProtection(msg.passphrase || false);
    resetDevice.setPinProtection(msg.pin || false);
    resetDevice.setLabel(msg.label);
    if (msg.autoLockDelayMs) {
      resetDevice.setAutoLockDelayMs(msg.autoLockDelayMs);
    }
    resetDevice.setU2fCounter(msg.u2fCounter || Math.floor(+new Date() / 1000));
    // resetDevice.setWordsPerGape(wordsPerScreen) // Re-enable when patch gets in
    // Send
    await this.transport.call(Messages.MessageType.MESSAGETYPE_RESETDEVICE, resetDevice, {
      msgTimeout: core.LONG_TIMEOUT,
    });
    this.cacheFeatures(undefined);
  }

  public async recover(r: core.RecoverDevice): Promise<void> {
    const msg = new Messages.RecoveryDevice();
    msg.setWordCount({ 128: 12, 192: 18, 256: 24 }[r.entropy]);
    msg.setPassphraseProtection(r.passphrase);
    msg.setPinProtection(r.pin);
    msg.setLabel(r.label);
    msg.setLanguage(r.language || "english");
    msg.setEnforceWordlist(true);
    msg.setUseCharacterCipher(true);
    if (r.autoLockDelayMs) {
      msg.setAutoLockDelayMs(r.autoLockDelayMs);
    }
    msg.setU2fCounter(r.u2fCounter || Math.floor(+new Date() / 1000));
    await this.transport.call(Messages.MessageType.MESSAGETYPE_RECOVERYDEVICE, msg, {
      msgTimeout: core.LONG_TIMEOUT,
    });
    this.cacheFeatures(undefined);
  }

  public async pressYes(): Promise<void> {
    return this.press(true);
  }

  public async pressNo(): Promise<void> {
    return this.press(false);
  }

  public async press(isYes: boolean): Promise<void> {
    const decision = new Messages.DebugLinkDecision();
    decision.setYesNo(isYes);

    await this.transport.call(Messages.MessageType.MESSAGETYPE_DEBUGLINKDECISION, decision, {
      noWait: true,
      debugLink: true,
    });
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
    return true;
  }

  public supportsOfflineSigning(): boolean {
    return true;
  }

  public supportsBroadcast(): boolean {
    return false;
  }

  public async sendPin(pin: string): Promise<void> {
    const matrixAck = new Messages.PinMatrixAck();
    matrixAck.setPin(pin);
    await this.transport.call(Messages.MessageType.MESSAGETYPE_PINMATRIXACK, matrixAck, {
      msgTimeout: core.DEFAULT_TIMEOUT,
      omitLock: true,
      noWait: true,
    });
  }

  public async sendPassphrase(passphrase: string): Promise<void> {
    const passphraseAck = new Messages.PassphraseAck();
    passphraseAck.setPassphrase(passphrase);
    await this.transport.call(Messages.MessageType.MESSAGETYPE_PASSPHRASEACK, passphraseAck, {
      msgTimeout: core.DEFAULT_TIMEOUT,
      omitLock: true,
      noWait: true,
    });
  }

  public async sendCharacter(character: string): Promise<void> {
    await this.sendCharacterProto(character, false, false);
  }

  public async sendCharacterDelete(): Promise<void> {
    await this.sendCharacterProto("", true, false);
  }

  public async sendCharacterDone(): Promise<void> {
    await this.sendCharacterProto("", false, true);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async sendWord(word: string): Promise<void> {
    throw new Error("Not Yet Implemented :(");
  }

  public async sendCharacterProto(character: string, _delete: boolean, _done: boolean): Promise<any> {
    const characterAck = new Messages.CharacterAck();
    if (character !== "") {
      characterAck.setCharacter(character);
    } else if (_delete) {
      characterAck.setDelete(_delete);
    } else if (_done) {
      characterAck.setDone(_done);
    }
    await this.transport.call(Messages.MessageType.MESSAGETYPE_CHARACTERACK, characterAck, {
      msgTimeout: core.DEFAULT_TIMEOUT,
      omitLock: true,
      noWait: true,
    });
  }

  // ApplyPolicy enables or disables a named policy such as "ShapeShift" on the device
  public async applyPolicy(p: Required<Types.PolicyType.AsObject>): Promise<void> {
    const policy = new Types.PolicyType();
    policy.setPolicyName(p.policyName);
    policy.setEnabled(p.enabled);
    const applyPolicies = new Messages.ApplyPolicies();
    applyPolicies.setPolicyList([policy]);
    await this.transport.call(Messages.MessageType.MESSAGETYPE_APPLYPOLICIES, applyPolicies, {
      msgTimeout: core.LONG_TIMEOUT,
    });
    this.cacheFeatures(undefined);
  }

  // ApplySettings changes the label, language, and enabling/disabling the passphrase
  // The default language is english
  public async applySettings(s: Messages.ApplySettings.AsObject): Promise<void> {
    const applySettings = new Messages.ApplySettings();
    if (s.label) {
      applySettings.setLabel(s.label);
    }
    if (s.language) {
      applySettings.setLanguage(s.language);
    }
    if (s.usePassphrase !== undefined) {
      applySettings.setUsePassphrase(s.usePassphrase);
    }
    if (s.autoLockDelayMs) {
      applySettings.setAutoLockDelayMs(s.autoLockDelayMs);
    }
    if (s.u2fCounter) {
      applySettings.setU2fCounter(s.u2fCounter);
    }
    await this.transport.call(Messages.MessageType.MESSAGETYPE_APPLYSETTINGS, applySettings);
    this.cacheFeatures(undefined);
  }

  // Cancel aborts the last device action that required user interaction
  // It can follow a button request, passphrase request, or pin request
  public async cancel(): Promise<void> {
    await this.transport.cancel();
  }

  // ChangePin requests setting/changing the pin
  public async changePin(): Promise<void> {
    const changePin = new Messages.ChangePin();
    // User may be propmpted for button press up to 2 times
    await this.transport.call(Messages.MessageType.MESSAGETYPE_CHANGEPIN, changePin, {
      msgTimeout: core.LONG_TIMEOUT,
    });
  }

  // CipherKeyValue encrypts or decrypts a value with a given key, nodepath, and initializationVector
  // This method encrypts if encrypt is true and decrypts if false, the confirm paramater determines wether
  // the user is prompted on the device. See EncryptKeyValue() and DecryptKeyValue() for convenience methods
  // NOTE: If the length of the value in bytes is not divisible by 16 it will be zero padded
  public async cipherKeyValue(
    v: Messages.CipherKeyValue.AsObject & Required<Pick<Messages.CipherKeyValue.AsObject, "key">>
  ): Promise<string | Uint8Array> {
    // if(val.length % 16 !== 0) val = val.concat() TODO THIS
    const cipherKeyValue = new Messages.CipherKeyValue();
    cipherKeyValue.setAddressNList(v.addressNList);
    cipherKeyValue.setKey(v.key);
    cipherKeyValue.setValue(v.value);
    cipherKeyValue.setEncrypt(!!v.encrypt);
    cipherKeyValue.setAskOnEncrypt(v.askOnEncrypt || false);
    cipherKeyValue.setAskOnDecrypt(v.askOnDecrypt || false);
    cipherKeyValue.setIv(v.iv || "");
    const response = await this.transport.call(Messages.MessageType.MESSAGETYPE_CIPHERKEYVALUE, cipherKeyValue);
    const ckv = response.message as Messages.CipheredKeyValue;
    return ckv.getValue();
  }

  // ClearSession clears cached session values such as the pin and passphrase
  public async clearSession(): Promise<void> {
    const clearSession = new Messages.ClearSession();
    await this.transport.call(Messages.MessageType.MESSAGETYPE_CLEARSESSION, clearSession);
    this.cacheFeatures(undefined);
  }

  // DecryptKeyValue is a convenience method around decrypting with CipherKeyValue().
  // For more granular control of the process use CipherKeyValue()
  public async decryptKeyValue(
    v: Messages.CipherKeyValue.AsObject & Required<Pick<Messages.CipherKeyValue.AsObject, "key">>
  ): Promise<string | Uint8Array> {
    return this.cipherKeyValue(v);
  }

  // FirmwareErase askes the device to erase its firmware
  public async firmwareErase(): Promise<void> {
    const firmwareErase = new Messages.FirmwareErase();
    // send
    await this.transport.call(Messages.MessageType.MESSAGETYPE_FIRMWAREERASE, firmwareErase);
    this.cacheFeatures(undefined);
  }

  public async firmwareUpload(firmware: Buffer): Promise<void> {
    const firmwareUpload = new Messages.FirmwareUpload();
    const hash = await this.transport.getFirmwareHash(firmware);
    firmwareUpload.setPayload(firmware);
    firmwareUpload.setPayloadHash(hash);
    await this.transport.call(Messages.MessageType.MESSAGETYPE_FIRMWAREUPLOAD, firmwareUpload);
    this.cacheFeatures(undefined);
  }

  // Initialize assigns a hid connection to this KeepKey and send initialize message to device
  public async initialize(): Promise<Messages.Features.AsObject> {
    const initialize = new Messages.Initialize();
    const event = await this.transport.call(Messages.MessageType.MESSAGETYPE_INITIALIZE, initialize);
    if (!event.message) throw event;
    const out = event.message as Messages.Features.AsObject;
    this.features = out;

    // v6.1.0 firmware changed usb serial numbers to match STM32 desig_device_id
    // If the deviceId in the features table doesn't match, then we need to
    // add another k-v pair to the keyring so it can be looked up either way.
    const transportDeviceID = await this.transport.getDeviceID();
    if (out.deviceId && transportDeviceID !== out.deviceId) {
      this.transport.keyring.addAlias(transportDeviceID, out.deviceId);
    }

    const fwVersion = `v${out.majorVersion}.${out.minorVersion}.${out.patchVersion}`;
    //Lost Support per proto 44.3
    this._supportsOsmosis = semver.gte(fwVersion, "v7.4.0");
    this._supportsCosmos = semver.gte(fwVersion, "v7.3.0");
    this._supportsRipple = semver.gte(fwVersion, "v6.4.0");
    this._supportsBinance = semver.gte(fwVersion, "v6.4.0");
    this._supportsEos = semver.gte(fwVersion, "v6.4.0");
    // this._supportsThorchain = semver.get(fwVersion, "v7.3.0");

    this.cacheFeatures(out);
    return out;
  }

  // GetFeatures returns the features and other device information such as the version, label, and supported coins
  public async getFeatures(cached = false): Promise<Messages.Features.AsObject> {
    if (cached && this.featuresCache) return this.featuresCache;
    const features = new Messages.GetFeatures();
    const event = await this.transport.call(Messages.MessageType.MESSAGETYPE_GETFEATURES, features);
    this.cacheFeatures(event.message);
    return event.message as Messages.Features.AsObject;
  }

  public cacheFeatures(features?: Messages.Features.AsObject): void {
    this.featuresCache = features;
  }

  // GetEntropy requests sample data from the hardware RNG
  public async getEntropy(size: number): Promise<Uint8Array> {
    const getEntropy = new Messages.GetEntropy();
    getEntropy.setSize(size);
    // send
    const event = await this.transport.call(Messages.MessageType.MESSAGETYPE_GETENTROPY, getEntropy, {
      msgTimeout: core.LONG_TIMEOUT,
    });
    return (core.mustBeDefined(event.proto) as Messages.Entropy).getEntropy_asU8();
  }

  // GetNumCoins returns the number of coins supported by the device regardless of if the hanve funds.
  public async getNumCoins(): Promise<number> {
    const getCoinTable = new Messages.GetCoinTable();
    const response = await this.transport.call(Messages.MessageType.MESSAGETYPE_GETCOINTABLE, getCoinTable);
    return core.mustBeDefined((core.mustBeDefined(response.proto) as Messages.CoinTable).getNumCoins());
  }

  // GetCoinTable returns an array of Types.CoinTypes, with start and end arguments for paging.
  // You cannot request more than 10 at a time.
  public async getCoinTable(start = 0, end: number = start + 10): Promise<Types.CoinType.AsObject[]> {
    const getCoinTable = new Messages.GetCoinTable();
    getCoinTable.setStart(start);
    getCoinTable.setEnd(end);
    const response = await this.transport.call(Messages.MessageType.MESSAGETYPE_GETCOINTABLE, getCoinTable);
    const coinTable = response.message as Messages.CoinTable.AsObject;
    return coinTable.tableList;
  }

  // LoadDevice loads a provided seed onto the device and applies the provided settings
  // including setting a pin/device label, enabling/disabling the passphrase, and whether to
  // check the checksum of the provided mnemonic
  public async loadDevice(msg: core.LoadDevice): Promise<void> {
    const loadDevice = new Messages.LoadDevice();
    loadDevice.setMnemonic(msg.mnemonic);
    loadDevice.setPassphraseProtection(!!msg.passphrase);
    loadDevice.setSkipChecksum(!!msg.skipChecksum);
    if (msg.pin) loadDevice.setPin(msg.pin);
    if (msg.label) loadDevice.setLabel(msg.label);
    // send
    await this.transport.call(Messages.MessageType.MESSAGETYPE_LOADDEVICE, loadDevice, {
      msgTimeout: core.LONG_TIMEOUT,
    });
    this.cacheFeatures(undefined);
  }

  // RemovePin disables pin protection for the device. If a pin is currently enabled
  // it will prompt the user to enter the current pin
  public async removePin(): Promise<void> {
    const changePin = new Messages.ChangePin();
    changePin.setRemove(true);
    // send
    await this.transport.call(Messages.MessageType.MESSAGETYPE_CHANGEPIN, changePin);
    this.cacheFeatures(undefined);
  }

  public async send(events: core.Event[]): Promise<void> {
    for (const event of events) {
      const MessageType = messageTypeRegistry[core.mustBeDefined(event.message_enum)] as any;
      const msg = new MessageType();
      Object.entries(event.message).forEach(([key, value]) => {
        const setterMethod = protoFieldToSetMethod(key);
        if (msg[setterMethod]) {
          // Assume setter methods are always of the format: strength -> setStrength
          // until this exists https://github.com/protocolbuffers/protobuf/issues/1591
          msg[setterMethod](value);
        }
      });
      await this.transport.call(core.mustBeDefined(event.message_enum), msg);
    }
  }

  // SoftReset power cycles the device. The device only responds to
  // this message while in manufacturer mode
  public async softReset(): Promise<void> {
    const softReset = new Messages.SoftReset();
    // send
    await this.transport.call(Messages.MessageType.MESSAGETYPE_SOFTRESET, softReset);
    this.cacheFeatures(undefined);
  }

  // WipeDevice wipes all sensitive data and settings
  public async wipe(): Promise<void> {
    const wipeDevice = new Messages.WipeDevice();
    // send
    await this.transport.call(Messages.MessageType.MESSAGETYPE_WIPEDEVICE, wipeDevice);
    this.cacheFeatures(undefined);
  }

  public async btcSupportsCoin(coin: core.Coin): Promise<boolean> {
    return this.info.btcSupportsCoin(coin);
  }

  public async btcSupportsScriptType(coin: core.Coin, scriptType: core.BTCInputScriptType): Promise<boolean> {
    return this.info.btcSupportsScriptType(coin, scriptType);
  }

  public async btcGetAddress(msg: core.BTCGetAddress): Promise<string> {
    return Btc.btcGetAddress(this, this.transport, msg);
  }

  public async btcSignTx(msg: core.BTCSignTxKK): Promise<core.BTCSignedTx> {
    return Btc.btcSignTx(this, this.transport, msg);
  }

  public async btcSupportsSecureTransfer(): Promise<boolean> {
    return this.info.btcSupportsSecureTransfer();
  }

  public btcSupportsNativeShapeShift(): boolean {
    return this.info.btcSupportsNativeShapeShift();
  }

  public async ethSupportsEIP1559(): Promise<boolean> {
    // EIP1559 support starts in v7.2.1
    return semver.gte(await this.getFirmwareVersion(), "v7.2.1");
  }

  public async btcSignMessage(msg: core.BTCSignMessage): Promise<core.BTCSignedMessage> {
    return Btc.btcSignMessage(this, this.transport, msg);
  }

  public async btcVerifyMessage(msg: core.BTCVerifyMessage): Promise<boolean> {
    return Btc.btcVerifyMessage(this, this.transport, msg);
  }

  public btcGetAccountPaths(msg: core.BTCGetAccountPaths): Array<core.BTCAccountPath> {
    return this.info.btcGetAccountPaths(msg);
  }

  public btcIsSameAccount(msg: Array<core.BTCAccountPath>): boolean {
    // TODO: mixed-mode segwit was added in v6.0.2
    // https://github.com/keepkey/keepkey-firmware/pull/81
    // if (firmware_version.lt('6.0.2') && msg.length > 1)
    //  return false

    return this.info.btcIsSameAccount(msg);
  }

  public async ethSignTx(msg: core.ETHSignTx): Promise<core.ETHSignedTx> {
    return Eth.ethSignTx(this.transport, msg);
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

  public ethGetAccountPaths(msg: core.ETHGetAccountPath): Array<core.ETHAccountPath> {
    return this.info.ethGetAccountPaths(msg);
  }

  public rippleGetAccountPaths(msg: core.RippleGetAccountPaths): Array<core.RippleAccountPath> {
    return this.info.rippleGetAccountPaths(msg);
  }

  public rippleGetAddress(msg: core.RippleGetAddress): Promise<string> {
    return Ripple.rippleGetAddress(this.transport, msg);
  }

  public rippleSignTx(msg: core.RippleSignTx): Promise<core.RippleSignedTx> {
    return Ripple.rippleSignTx(this.transport, msg);
  }

  public cosmosGetAccountPaths(msg: core.CosmosGetAccountPaths): Array<core.CosmosAccountPath> {
    return this.info.cosmosGetAccountPaths(msg);
  }

  public cosmosGetAddress(msg: core.CosmosGetAddress): Promise<string> {
    return Cosmos.cosmosGetAddress(this.transport, msg);
  }

  public cosmosSignTx(msg: core.CosmosSignTx): Promise<core.CosmosSignedTx> {
    return Cosmos.cosmosSignTx(this.transport, msg);
  }

  public thorchainGetAccountPaths(msg: core.ThorchainGetAccountPaths): Array<core.ThorchainAccountPath> {
    return this.info.thorchainGetAccountPaths(msg);
  }

  public thorchainGetAddress(msg: core.ThorchainGetAddress): Promise<string | null> {
    return Thorchain.thorchainGetAddress(this.transport, msg);
  }

  public thorchainSignTx(msg: core.ThorchainSignTx): Promise<core.ThorchainSignedTx> {
    return Thorchain.thorchainSignTx(this.transport, msg);
  }

  public binanceGetAccountPaths(msg: core.BinanceGetAccountPaths): Array<core.BinanceAccountPath> {
    return this.info.binanceGetAccountPaths(msg);
  }

  public binanceGetAddress(msg: core.BinanceGetAddress): Promise<string> {
    return Binance.binanceGetAddress(this.transport, msg);
  }

  public binanceSignTx(msg: core.BinanceSignTx): Promise<core.BinanceSignedTx> {
    return Binance.binanceSignTx(this.transport, msg);
  }

  public eosGetAccountPaths(msg: core.EosGetAccountPaths): Array<core.EosAccountPath> {
    return this.info.eosGetAccountPaths(msg);
  }

  public eosGetPublicKey(msg: core.EosGetPublicKey): Promise<string> {
    return Eos.eosGetPublicKey(this.transport, msg);
  }

  public eosSignTx(msg: core.EosToSignTx): Promise<core.EosTxSigned> {
    return Eos.eosSignTx(this.transport, msg);
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

  public eosNextAccountPath(msg: core.EosAccountPath): core.EosAccountPath | undefined {
    return this.info.eosNextAccountPath(msg);
  }

  public cosmosNextAccountPath(msg: core.CosmosAccountPath): core.CosmosAccountPath | undefined {
    return this.info.cosmosNextAccountPath(msg);
  }

  public rippleNextAccountPath(msg: core.RippleAccountPath): core.RippleAccountPath | undefined {
    return this.info.rippleNextAccountPath(msg);
  }

  public binanceNextAccountPath(msg: core.BinanceAccountPath): core.BinanceAccountPath | undefined {
    return this.info.binanceNextAccountPath(msg);
  }
}

export function info(): KeepKeyHDWalletInfo {
  return new KeepKeyHDWalletInfo();
}

export function create(transport: Transport): KeepKeyHDWallet {
  return new KeepKeyHDWallet(transport);
}
