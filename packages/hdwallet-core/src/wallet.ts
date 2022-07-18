import _ from "lodash";

import { BinanceWallet, BinanceWalletInfo } from "./binance";
import { BTCInputScriptType, BTCWallet, BTCWalletInfo } from "./bitcoin";
import { CosmosWallet, CosmosWalletInfo } from "./cosmos";
import { DebugLinkWallet } from "./debuglink";
import { EosWallet, EosWalletInfo } from "./eos";
import { ETHWallet, ETHWalletInfo } from "./ethereum";
import { FioWallet, FioWalletInfo } from "./fio";
import { KavaWallet, KavaWalletInfo } from "./kava";
import { OsmosisWallet, OsmosisWalletInfo } from "./osmosis";
import { RippleWallet, RippleWalletInfo } from "./ripple";
import { SecretWallet, SecretWalletInfo } from "./secret";
import { TerraWallet, TerraWalletInfo } from "./terra";
import { ThorchainWallet, ThorchainWalletInfo } from "./thorchain";
import { Transport } from "./transport";

export type BIP32Path = Array<number>;

export interface GetPublicKey {
  addressNList: BIP32Path;
  showDisplay?: boolean;
  scriptType?: BTCInputScriptType; // Defaults to BTCInputScriptType.SpendAddress
  curve: string;
  coin: Coin;
}

export interface PublicKey {
  xpub: string;
}

export interface Ping {
  msg: string;
  passphrase?: boolean;
  pin?: boolean;
  button?: boolean;
}

export interface Pong {
  msg: string;
}

export interface ResetDevice {
  /** Bits. Either 128 (12 words), 192 (18 words), or 256 (24 words)*/
  entropy?: 128 | 192 | 256;
  label: string;
  passphrase?: boolean;
  pin?: boolean;
  autoLockDelayMs?: number;
  u2fCounter?: number;
}

export interface RecoverDevice {
  /** Bits. Either 128 (12 words), 192 (18 words), or 256 (24 words)*/
  entropy: 128 | 192 | 256;
  label: string;
  passphrase: boolean;
  pin: boolean;
  language?: string;
  autoLockDelayMs?: number;
  u2fCounter?: number;
}

export interface LoadDevice {
  /** 12, 18, or 24 word BIP39 mnemonic */
  mnemonic: string;
  /** User-identifiable device label */
  label?: string;
  /** Whether passphrase protection should be enabled */
  passphrase?: boolean;
  /** pin, in plaintext */
  pin?: string;
  /** Whether to enforce checksum */
  skipChecksum?: boolean;
}

export interface ExchangeType {
  /** `SignedExchangeResponse` from the `/sendamountProto2` ShapeShift endpoint, base64 encoded */
  signedExchangeResponse: string;
  withdrawalCoinName: string;
  withdrawalAddressNList: BIP32Path;
  withdrawalScriptType?: BTCInputScriptType;
  returnAddressNList: BIP32Path;
  returnScriptType?: BTCInputScriptType;
}

export interface DescribePath {
  path: BIP32Path;
  coin: Coin;
  scriptType?: BTCInputScriptType;
}

export interface PathDescription {
  isKnown: boolean;
  verbose: string;
  coin: Coin;
  scriptType?: BTCInputScriptType;
  accountIdx?: number;
  addressIdx?: number;
  isChange?: boolean;
  wholeAccount?: boolean;
  isPrefork?: boolean;
}

export type Coin = string;
export type Symbol = string;

/**
 * Type guards
 *
 * Example Usage:
 ```typescript
 const wallet: HDWallet = ...
 if (supportsBTC(wallet)) {
   wallet.btcGetAddress(...)
 }
 ```
 */

export function supportsBTC(wallet: HDWallet): wallet is BTCWallet {
  return _.isObject(wallet) && (wallet as any)._supportsBTC;
}

export function infoBTC(info: HDWalletInfo): info is BTCWalletInfo {
  return _.isObject(info) && (info as any)._supportsBTCInfo;
}

export function supportsETH(wallet: HDWallet): wallet is ETHWallet {
  return _.isObject(wallet) && (wallet as any)._supportsETH;
}

export function infoETH(info: HDWalletInfo): info is ETHWalletInfo {
  return _.isObject(info) && (info as any)._supportsETHInfo;
}

export function supportsCosmos(wallet: HDWallet): wallet is CosmosWallet {
  return _.isObject(wallet) && (wallet as any)._supportsCosmos;
}

export function supportsEthSwitchChain(wallet: HDWallet): wallet is ETHWallet {
  return _.isObject(wallet) && (wallet as any)._supportsEthSwitchChain;
}

export function infoCosmos(info: HDWalletInfo): info is CosmosWalletInfo {
  return _.isObject(info) && (info as any)._supportsCosmosInfo;
}

export function supportsOsmosis(wallet: HDWallet): wallet is OsmosisWallet {
  return _.isObject(wallet) && (wallet as any)._supportsOsmosis;
}

export function infoOsmosis(info: HDWalletInfo): info is OsmosisWalletInfo {
  return _.isObject(info) && (info as any)._supportsOsmosisInfo;
}

export function supportsThorchain(wallet: HDWallet): wallet is ThorchainWallet {
  return _.isObject(wallet) && (wallet as any)._supportsThorchain;
}

export function infoThorchain(info: HDWalletInfo): info is ThorchainWalletInfo {
  return _.isObject(info) && (info as any)._supportsThorchainInfo;
}

export function supportsEos(wallet: HDWallet): wallet is EosWallet {
  return _.isObject(wallet) && (wallet as any)._supportsEos;
}

export function infoEos(info: HDWalletInfo): info is EosWalletInfo {
  return _.isObject(info) && (info as any)._supportsEosInfo;
}

export function supportsFio(wallet: HDWallet): wallet is FioWallet {
  return _.isObject(wallet) && (wallet as any)._supportsFio;
}

export function infoFio(info: HDWalletInfo): info is FioWalletInfo {
  return _.isObject(info) && (info as any)._supportsFioInfo;
}

export function supportsSecret(wallet: HDWallet): wallet is SecretWallet {
  return _.isObject(wallet) && (wallet as any)._supportsSecret;
}

export function infoSecret(info: HDWalletInfo): info is SecretWalletInfo {
  return _.isObject(info) && (info as any)._supportsSecretInfo;
}

export function supportsTerra(wallet: HDWallet): wallet is TerraWallet {
  return _.isObject(wallet) && (wallet as any)._supportsTerra;
}

export function infoTerra(info: HDWalletInfo): info is TerraWalletInfo {
  return _.isObject(info) && (info as any)._supportsTerraInfo;
}

export function supportsKava(wallet: HDWallet): wallet is KavaWallet {
  return _.isObject(wallet) && (wallet as any)._supportsKava;
}

export function infoKava(info: HDWalletInfo): info is KavaWalletInfo {
  return _.isObject(info) && (info as any)._supportsKavaInfo;
}

export function supportsRipple(wallet: HDWallet): wallet is RippleWallet {
  return _.isObject(wallet) && (wallet as any)._supportsRipple;
}

export function infoRipple(info: HDWalletInfo): info is RippleWalletInfo {
  return _.isObject(info) && (info as any)._supportsRippleInfo;
}

export function supportsBinance(wallet: HDWallet): wallet is BinanceWallet {
  return _.isObject(wallet) && (wallet as any)._supportsBinance;
}

export function infoBinance(info: HDWalletInfo): info is BinanceWalletInfo {
  return _.isObject(info) && (info as any)._supportsBinanceInfo;
}

export function supportsDebugLink(wallet: HDWallet): wallet is DebugLinkWallet {
  return _.isObject(wallet) && (wallet as any)._supportsDebugLink;
}

export interface HDWalletInfo {
  /**
   * Retrieve the wallet's vendor string.
   */
  getVendor(): string;

  /**
   * Does the wallet need the user to enter their pin through the device?
   */
  hasOnDevicePinEntry(): boolean;

  /**
   * Does the wallet need the user to enter their passphrase through the device?
   */
  hasOnDevicePassphrase(): boolean;

  /**
   * Does the wallet have a screen for displaying addresses / confirming?
   */
  hasOnDeviceDisplay(): boolean;

  /**
   * Does the wallet use a recovery method that does not involve communicating
   * with the host? Eg. for a KeepKey, this is `false` since we use Ciphered
   * Recovery, but for a Ledger it's `true` since you enter words using only
   * the device.
   */
  hasOnDeviceRecovery(): boolean;

  /**
   * Does the device support `/sendamountProto2` style native ShapeShift
   * integration for the given pair?
   */
  hasNativeShapeShift(srcCoin: Coin, dstCoin: Coin): boolean;

  /**
   * Will the device allow for transactions to be signed offline to be
   * broadcasted separately?
   */
  supportsOfflineSigning(): boolean;

  /**
   * Can the device broadcast signed transactions internally?
   */
  supportsBroadcast(): boolean;

  /**
   * Describes a BIP32 path in plain English.
   */
  describePath(msg: DescribePath): PathDescription;
}

export interface HDWallet extends HDWalletInfo {
  transport?: Transport;

  /**
   * Retrieve the wallet's unique ID
   */
  getDeviceID(): Promise<string>;

  /**
   * Get device specific features
   */
  getFeatures(): Promise<Record<string, unknown>>;

  /**
   * Retrieve the wallet's firmware version
   */
  getFirmwareVersion(): Promise<string>;

  /**
   * Retrieve the name of the model of wallet, eg 'KeepKey' or 'Trezor One'
   */
  getModel(): Promise<string>;

  /**
   * Retrieve the device's user-assigned label.
   */
  getLabel(): Promise<string>;

  /**
   * Derive one or more xpubs.
   */
  getPublicKeys(msg: Array<GetPublicKey>): Promise<Array<PublicKey | null> | null>;

  /**
   * Check whether the device has been initialized with a secret.
   */
  isInitialized(): Promise<boolean>;

  /**
   * Check whether the device is locked.
   */
  isLocked(): Promise<boolean>;

  /**
   * Clear cached pin / passphrase, and lock the wallet.
   */
  clearSession(): Promise<void>;

  /**
   * Initialize a device session.
   */
  initialize(): Promise<any>;

  /**
   * Send a ping to the device.
   */
  ping(msg: Ping): Promise<Pong>;

  /**
   * Respond to device with the user's pin.
   *
   * For KeepKey/Trezor, this would be encoded with the PIN matrix OTP, so the
   * host cannot decipher it without actually seeing the device's screen.
   */
  sendPin(pin: string): Promise<void>;

  /**
   * Respond to device with the user's BIP39 passphrase.
   */
  sendPassphrase(passphrase: string): Promise<void>;

  /**
   * Respond to device with a character that the user entered.
   */
  sendCharacter(charater: string): Promise<void>;

  /**
   * Respond to device with a word that the user entered.
   */
  sendWord(word: string): Promise<void>;

  /**
   * Cancel an in-progress operation
   */
  cancel(): Promise<void>;

  /**
   * Erase all secrets and lock the wallet.
   */
  wipe(): Promise<void>;

  /**
   * Initialize a wiped device with brand new secrets generated by the device.
   */
  reset(msg: ResetDevice): Promise<void>;

  /**
   * Recover a wiped device with an existing BIP39 seed phrase.
   */
  recover(msg: RecoverDevice): Promise<void>;

  /**
   * Initialize a device with a raw BIP39 seed phrase in plaintext.
   *
   * **Extreme** care is needed when loading BIP39 seed phrases this way, as
   * the phrase is exposed in plaintext to the host machine. It is not
   * recommended to use this method of re-initialization except for unittests,
   * or if you really really know what you're doing on an **airgapped** machine.
   */
  loadDevice(msg: LoadDevice): Promise<void>;

  /**
   * Close connection with device
   */
  disconnect(): Promise<void>;
}
