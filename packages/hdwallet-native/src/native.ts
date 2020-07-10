import * as core from "@shapeshiftoss/hdwallet-core";
import { mnemonicToSeed } from "bip39";
import { fromSeed } from "bip32";
import { MixinNativeBTCWallet, MixinNativeBTCWalletInfo } from "./bitcoin";
import { MixinNativeETHWalletInfo } from "./ethereum";
import {
  addressNListToBIP32,
  hardenedPath,
} from "@shapeshiftoss/hdwallet-core";

import * as bitcoin from "bitcoinjs-lib";
import { mnemonicToSeed } from "bip39"

export class NativeHDWalletInfo implements core.HDWalletInfo {
  _supportsBTCInfo: boolean = true;
  _supportsETHInfo: boolean = true;
  _supportsCosmosInfo: boolean = false;
  _supportsBinanceInfo: boolean = false;
  _supportsRippleInfo: boolean = false;
  _supportsEosInfo: boolean = false;

  getVendor(): string {
    return "Native";
  }

  hasOnDevicePinEntry(): boolean {
    return false;
  }

  hasOnDevicePassphrase(): boolean {
    return false;
  }

  hasOnDeviceDisplay(): boolean {
    return false;
  }

  hasOnDeviceRecovery(): boolean {
    return false;
  }

  hasNativeShapeShift(): boolean {
    return false;
  }

  describePath(msg: core.DescribePath): core.PathDescription {
    switch (msg.coin) {
      case "Bitcoin":
        const unknown = core.unknownUTXOPath(
          msg.path,
          msg.coin,
          msg.scriptType
        );

        if (!super.btcSupportsCoin(msg.coin)) return unknown;
        if (!super.btcSupportsScriptType(msg.coin, msg.scriptType))
          return unknown;

        return core.describeUTXOPath(msg.path, msg.coin, msg.scriptType);
      case "Ethereum":
        return core.describeETHPath(msg.path);
      default:
        throw new Error("Unsupported path");
    }
  }
}

export interface NativeHDWalletInfo
  extends NativeBTCWalletInfo,
    NativeETHWalletInfo {}
core.applyMixins(NativeHDWalletInfo, [
  NativeBTCWalletInfo,
  NativeETHWalletInfo,
]);

interface ScriptType {
  node: bitcoin.BIP32Interface
  path: string
}

type UndScriptyTypes = 'p2pkh' | 'p2sh-p2wpkh'

export interface Coin {
  network: bitcoin.Network
  rootNode: bitcoin.BIP32Interface
  scripts: {
    [k in UndScriptyTypes]: ScriptType
  }
}

export class NativeHDWallet extends NativeHDWalletInfo implements
  core.HDWallet, NativeBTCWallet {
  _supportsBTC = true;
  _supportsETH = true;
  _supportsCosmos = false;
  _supportsBinance = false;
  _supportsRipple = false;
  _supportsEos = false;
  _supportsDebugLink = false;
  _isNative = true;

  deviceId: string;
  btcWallet: Coin;

  private mnemonic: string;

  constructor(mnemonic: string, deviceId: string) {
    super();
    this.mnemonic = mnemonic;
    this.deviceId = deviceId;
  }

  public async ensureBTCWallet(): Promise<void> {
    if (this.btcWallet) return

    const seed = Buffer.from(await mnemonicToSeed(this.mnemonic))
    const rootNode = bitcoin.bip32.fromSeed(seed, bitcoin.networks.bitcoin)
  
    this.btcWallet = {
      network: bitcoin.networks.bitcoin,
      rootNode,
      scripts: {
        p2pkh: {
          node: rootNode.derivePath("m/44'/0'/0'"),
          path: "m/44'/0'/0'"
        },
        'p2sh-p2wpkh': {
          node: rootNode.derivePath("m/49'/0'/0'"),
          path: "m/49'/0'/0'"
        }
      }
    }
  }

  async getDeviceID(): Promise<string> {
    return Promise.resolve(this.deviceId);
  }

  async getFirmwareVersion(): Promise<string> {
    return Promise.resolve("Software");
  }

  getModel(): Promise<string> {
    return Promise.resolve("Native");
  }

  getLabel(): Promise<string> {
    return Promise.resolve("Native");
  }

  /*
   * @see: https://github.com/satoshilabs/slips/blob/master/slip-0132.md
   * to supports different styles of xpubs as can be defined by passing in a network to `fromSeed`
   */
  getPublicKeys(msg: Array<core.GetPublicKey>): Promise<Array<core.PublicKey>> {
    return Promise.all(
      msg.map(async (getPublicKey) => {
        let { addressNList } = getPublicKey;
        const seed = await mnemonicToSeed(this.mnemonic);
        const node = fromSeed(seed);
        const xpub = node
          .derivePath(addressNListToBIP32(hardenedPath(addressNList)))
          .neutered()
          .toBase58();
        return { xpub };
      })
    );
  }

  async isInitialized(): Promise<boolean> {
    return Promise.resolve(true);
  }

  async isLocked(): Promise<boolean> {
    return Promise.resolve(false);
  }

  clearSession(): Promise<void> {
    return Promise.resolve();
  }

  initialize(): Promise<any> {
    return Promise.resolve();
  }

  ping(msg: core.Ping): Promise<core.Pong> {
    return Promise.resolve({ msg: msg.msg });
  }

  sendPin(): Promise<void> {
    return Promise.resolve();
  }

  sendPassphrase(): Promise<void> {
    return Promise.resolve();
  }

  sendCharacter(): Promise<void> {
    return Promise.resolve();
  }

  sendWord(): Promise<void> {
    return Promise.resolve();
  }

  cancel(): Promise<void> {
    return Promise.resolve();
  }

  wipe(): Promise<void> {
    return Promise.resolve();
  }

  reset(): Promise<void> {
    return Promise.resolve();
  }

  recover(): Promise<void> {
    return Promise.resolve();
  }

  loadDevice(msg: core.LoadDevice): Promise<void> {
    this.mnemonic = msg.mnemonic;
    return Promise.resolve();
  }

  disconnect(): Promise<void> {
    return Promise.resolve();
  }

  public async btcGetAddress(msg: core.BTCGetAddress): Promise<string> {
    await this.ensureBTCWallet()
    return btcGetAddress(this, msg)
  }

  async btcSignTx(msg: core.BTCSignTx): Promise<core.BTCSignedTx> {
    await this.ensureBTCWallet()
    return btcSignTx(this, msg)
  }

  btcSignMessage(msg: core.BTCSignMessage): Promise<core.BTCSignedMessage> {
    return Promise.resolve(null)
  }

  btcVerifyMessage(msg: core.BTCVerifyMessage): Promise<boolean> {
    return Promise.resolve(null)
  }
}

//export interface NativeHDWallet extends NativeBTCWallet, NativeETHWallet {}
//core.applyMixins(NativeHDWallet, [NativeBTCWallet, NativeETHWallet]);

export function isNative(wallet: core.HDWallet): boolean {
  return wallet instanceof NativeHDWallet;
}

export function info() {
  return new NativeHDWalletInfo();
}

export function create(mnemonic: string, deviceId: string): NativeHDWallet {
  return new NativeHDWallet(mnemonic, deviceId);
}
