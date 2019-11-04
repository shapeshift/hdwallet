import {
  BTCInputScriptType,
  BTCWallet,
  BTCWalletInfo,
} from './bitcoin'

import {
  ETHWallet,
  ETHWalletInfo,
} from './ethereum'
import { DebugLinkWallet } from './debuglink'
import { Transport } from './transport';
import { isObject } from 'lodash';

export type BIP32Path = Array<number>

export interface GetPublicKey {
  addressNList: BIP32Path,
  showDisplay?: boolean,
  scriptType?: BTCInputScriptType,
  curve: string,
  coin?: Coin
}

export interface PublicKey {
  xpub: string,
}

export interface Ping {
  msg: string,
  passphrase?: boolean,
  pin?: boolean,
  button?: boolean
}

export interface Pong {
  msg: string
}

export interface ResetDevice {
  /** Bits. Either 128 (12 words), 192 (18 words), or 256 (24 words)*/
  entropy?: 128 | 192 | 256,
  label?: string,
  passphrase?: boolean,
  pin?: boolean,
  autoLockDelayMs?: number,
  u2fCounter?: number
}

export interface RecoverDevice {
  /** Bits. Either 128 (12 words), 192 (18 words), or 256 (24 words)*/
  entropy?: 128 | 192 | 256,
  label?: string,
  passphrase?: boolean,
  pin?: boolean,
  language?: string,
  autoLockDelayMs?: number,
  u2fCounter?: number
}

export interface LoadDevice {
  /** 12, 18, or 24 word BIP39 mnemonic */
  mnemonic: string,
  /** User-identifiable device label */
  label?: string
  /** Whether passphrase protection should be enabled */
  passphrase?: boolean,
  /** pin, in plaintext */
  pin?: string,
  /** Whether to enforce checksum */
  skipChecksum?: boolean
}

export interface ExchangeType {
  /** `SignedExchangeResponse` from the `/sendamountProto2` ShapeShift endpoint, base64 encoded */
  signedExchangeResponse: string,
  withdrawalCoinName: string,
  withdrawalAddressNList: BIP32Path,
  withdrawalScriptType?: BTCInputScriptType,
  returnAddressNList: BIP32Path,
  returnScriptType?: BTCInputScriptType,
}

export interface DescribePath {
  path: BIP32Path,
  coin: Coin,
  scriptType?: BTCInputScriptType
}

export interface PathDescription {
  isKnown: boolean,
  verbose: string,
  coin: Coin,
  scriptType?: BTCInputScriptType,
  accountIdx?: number,
  addressIdx?: number,
  isChange?: boolean,
  wholeAccount?: boolean,
  isPrefork?: boolean
}

type CoinWallets = BTCWallet | ETHWallet | DebugLinkWallet

export type Coin = string

/**
 * Type guard for BTCWallet Support
 *
 * Example Usage:
 ```typescript
 if (supportsBTC(wallet)) {
   wallet.btcGetAddress(...)
 }
 ```
 */
export function supportsBTC(wallet: any): wallet is BTCWallet {
  return isObject(wallet) && (wallet as any)._supportsBTC
}

export function infoBTC(info: any): info is BTCWalletInfo {
  return isObject(info) && (info as any)._supportsBTCInfo
}

/**
 * Type guard for ETHWallet Support
 *
 * Example Usage:
 ```typescript
 if (supportsETH(wallet)) {
   wallet.ethGetAddress(...)
 }
 ```
 */
export function supportsETH(wallet: any): wallet is ETHWallet {
  return isObject(wallet) && (wallet as any)._supportsETH
}

export function infoETH(info: any): info is ETHWalletInfo {
  return isObject(info) && (info as any)._supportsETHInfo
}

export function supportsDebugLink(wallet: any): wallet is DebugLinkWallet {
  return isObject(wallet) && (wallet as any)._supportsDebugLink
}

export interface HDWalletInfo {
  _supportsETHInfo: boolean
  _supportsBTCInfo: boolean

  /**
   * Retrieve the wallet's vendor string.
   */
  getVendor (): string

  /**
   * Does the wallet need the user to enter their pin through the device?
   */
  hasOnDevicePinEntry (): Promise<boolean>

  /**
   * Does the wallet need the user to enter their passphrase through the device?
   */
  hasOnDevicePassphrase (): Promise<boolean>

  /**
   * Does the wallet have a screen for displaying addresses / confirming?
   */
  hasOnDeviceDisplay (): Promise<boolean>

  /**
   * Does the wallet use a recovery method that does not involve communicating
   * with the host? Eg. for a KeepKey, this is `false` since we use Ciphered
   * Recovery, but for a Ledger it's `true` since you enter words using only
   * the device.
   */
  hasOnDeviceRecovery (): Promise<boolean>

  /**
   * Does the device support `/sendamountProto2` style native ShapeShift
   * integration for the given pair?
   */
  hasNativeShapeShift (srcCoin: Coin, dstCoin: Coin): Promise<boolean>

  /**
   * Describes a BIP32 path in plain English.
   */
  describePath (msg: DescribePath): PathDescription
}

export interface HDWallet extends HDWalletInfo {
  _supportsETHInfo: boolean
  _supportsBTCInfo: boolean
  _supportsBTC: boolean
  _supportsETH: boolean
  _supportsDebugLink: boolean

  transport: Transport

  /**
   * Retrieve the wallet's unique ID
   */
  getDeviceID (): Promise<string>

  /**
   * Retrieve the wallet's firmware version
   */
  getFirmwareVersion (): Promise<string>

  /**
   * Retrieve the name of the model of wallet, eg 'KeepKey' or 'Trezor One'
   */
  getModel (): Promise<string>

  /**
   * Retrieve the device's user-assigned label.
   */
  getLabel (): Promise<string>

  /**
   * Derive one or more xpubs.
   */
  getPublicKeys (msg: Array<GetPublicKey>): Promise<Array<PublicKey>>

  /**
   * Check whether the device has been initialized with a secret.
   */
  isInitialized (): Promise<boolean>

  /**
   * Check whether the device is locked.
   */
  isLocked (): Promise<boolean>

  /**
   * Clear cached pin / passphrase, and lock the wallet.
   */
  clearSession (): Promise<void>

  /**
   * Initialize a device session.
   */
  initialize (): Promise<any>

  /**
   * Send a ping to the device.
   */
  ping (msg: Ping): Promise<Pong>

  /**
   * Respond to device with the user's pin.
   *
   * For KeepKey/Trezor, this would be encoded with the PIN matrix OTP, so the
   * host cannot decipher it without actually seeing the device's screen.
   */
  sendPin (pin: string): Promise<void>

  /**
   * Respond to device with the user's BIP39 passphrase.
   */
  sendPassphrase (passphrase: string): Promise<void>

  /**
   * Respond to device with a character that the user entered.
   */
  sendCharacter (charater: string): Promise<void>

  /**
   * Respond to device with a word that the user entered.
   */
  sendWord (word: string): Promise<void>

  /**
   * Cancel an in-progress operation
   */
  cancel (): Promise<void>

  /**
   * Erase all secrets and lock the wallet.
   */
  wipe (): Promise<void>

  /**
   * Initialize a wiped device with brand new secrets generated by the device.
   */
  reset (msg: ResetDevice): Promise<void>

  /**
   * Recover a wiped device with an existing BIP39 seed phrase.
   */
  recover (msg: RecoverDevice): Promise<void>

  /**
   * Initialize a device with a raw BIP39 seed phrase in plaintext.
   *
   * **Extreme** care is needed when loading BIP39 seed phrases this way, as
   * the phrase is exposed in plaintext to the host machine. It is not
   * recommended to use this method of re-initialization except for unittests,
   * or if you really really know what you're doing on an **airgapped** machine.
   */
  loadDevice (msg: LoadDevice): Promise<void>

  /**
  * Close connection with device
  */
  disconnect (): Promise<void>
}
