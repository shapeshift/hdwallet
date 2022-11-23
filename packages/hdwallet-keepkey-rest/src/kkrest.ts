/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-unused-vars */
import * as Messages from "@keepkey/device-protocol/lib/messages_pb";
import * as Types from "@keepkey/device-protocol/lib/types_pb";
import * as core from "@keepkey/hdwallet-core";
import { getKeepKeySDK } from "@keepkey/keepkey-sdk";
import _ from "lodash";
import semver from "semver";

export function isKeepKey(wallet: core.HDWallet): wallet is KeepKeyRestHDWallet {
  return _.isObject(wallet) && (wallet as any)._isKeepKey;
}



export class KeepKeyRestHDWallet implements core.HDWallet, core.BTCWallet, core.ETHWallet, core.DebugLinkWallet {
  readonly _supportsETHInfo = true;
  readonly _supportsBTCInfo = true;
  readonly _supportsCosmosInfo = true;
  readonly _supportsRippleInfo = true;
  readonly _supportsBinanceInfo = true;
  readonly _supportsEosInfo = true;
  readonly _supportsFioInfo = false;
  readonly _supportsDebugLink: boolean;
  readonly _isKeepKey = true;
  readonly _supportsETH = true;
  readonly _supportsEthSwitchChain = false;
  readonly _supportsAvalanche = false;
  readonly _supportsBTC = true;
  _supportsCosmos = true;
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

  features?: Messages.Features.AsObject;

  featuresCache?: Messages.Features.AsObject;

  constructor() {
    this._supportsDebugLink = false;
  }

  private getSdk = () => {
    const spec = "http://localhost:1646/spec/swagger.json";
    const config = {
      serviceKey: process.env["SERVICE_KEY"] || "abc-1234sdfgdsf",
      serviceName: process.env["SERVICE_NAME"] || "KeepKey SDK Demo App",
      serviceImageUrl:
        process.env["SERVICE_IMAGE_URL"] ||
        "https://github.com/BitHighlander/keepkey-desktop/raw/master/electron/icon.png",
      spec,
    };
    return getKeepKeySDK(config);
  };

  static async create(): Promise<KeepKeyRestHDWallet> {
    return new KeepKeyRestHDWallet();
  }

  public async getDeviceID(): Promise<string> {
    throw new Error("not implemented");
  }

  public getVendor(): string {
    return "KeepKey";
  }

  public async getModel(): Promise<string> {
    return core.mustBeDefined((await this.getFeatures(true)).model);
  }

  public async getFirmwareVersion(): Promise<string> {
    const features = await this.getFeatures(true);
    return `v${features.majorVersion}.${features.minorVersion}.${features.patchVersion}`;
  }

  public async getLabel(): Promise<string> {
    return (await this.getFeatures(true)).label ?? "";
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
    const sdk = await this.getSdk();
    const publicKeysResponse = await sdk.wallet.getPublicKeys(getPublicKeys as any);
    return publicKeysResponse;
  }

  public async ping(msg: core.Ping): Promise<core.Pong> {
    throw new Error("not implemented");
  }

  public async reset(msg: core.ResetDevice): Promise<void> {
    const sdk = await this.getSdk();
    await sdk.developer.reset(msg as any);
  }

  public async recover(r: core.RecoverDevice): Promise<void> {
    const sdk = await this.getSdk();
    await sdk.recovery.recover(r as any);
  }

  public async pressYes(): Promise<void> {
    return this.press(true);
  }

  public async pressNo(): Promise<void> {
    return this.press(false);
  }

  public async press(isYes: boolean): Promise<void> {
    throw new Error("not implemented");
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

  public hasNativeShapeShift(srcCoin: core.Coin, dstCoin: core.Coin): boolean {
    return true;
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

  public async sendPin(pin: string): Promise<void> {
    throw new Error('WE NEED TO IMPLEMENT SEND PIN IN THE API & SDK')
  }

  public async sendPassphrase(passphrase: string): Promise<void> {
    throw new Error('WE NEED TO IMPLEMENT SEND PIN IN THE API & SDK')
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

  public async sendWord(word: string): Promise<void> {
    const sdk = await this.getSdk();
    await sdk.recovery.sendWord({ body: word });
  }

  public async sendCharacterProto(character: string, _delete: boolean, _done: boolean): Promise<any> {
    throw new Error("not implemented");
  }

  public async applyPolicy(p: Required<Types.PolicyType.AsObject>): Promise<void> {
    const sdk = await this.getSdk();
    await sdk.developer.applyPolicy({ body: p });
  }

  public async applySettings(s: Messages.ApplySettings.AsObject): Promise<void> {
    const sdk = await this.getSdk();
    await sdk.developer.applySettings({ body: s });
  }

  public async cancel(): Promise<void> {
    throw new Error("WE NEED TO IMPLEMENT SEND PIN IN THE API & SDK");
  }

  public async changePin(): Promise<void> {
    const sdk = await this.getSdk();
    await sdk.recovery.changePin({ body: undefined });
  }

  public async clearSession(): Promise<void> {
    const sdk = await this.getSdk();
    await sdk.developer.clearSession({ body: undefined });
  }

  public async firmwareErase(): Promise<void> {
    const sdk = await this.getSdk();
    await sdk.developer.firmwareErase({ body: undefined });
  }

  public async firmwareUpload(firmware: Buffer): Promise<void> {
    const sdk = await this.getSdk();
    await sdk.developer.firmwareUpload({ body: firmware });
  }

  public async initialize(): Promise<Messages.Features.AsObject> {
    throw new Error("WE NEED TO IMPLEMENT SEND PIN IN THE API & SDK");
  }

  public async getFeatures(cached = false): Promise<Messages.Features.AsObject> {
    throw new Error("WE NEED TO IMPLEMENT SEND PIN IN THE API & SDK");
  }

  public cacheFeatures(features?: Messages.Features.AsObject): void {
    this.featuresCache = features;
  }

  public async getEntropy(size: number): Promise<Uint8Array> {
    throw new Error("not implemented");
  }

  public async getNumCoins(): Promise<number> {
    throw new Error("not implemented");
  }

  public async getCoinTable(start = 0, end: number = start + 10): Promise<Types.CoinType.AsObject[]> {
    throw new Error("not implemented");
  }

  public async loadDevice(msg: core.LoadDevice): Promise<void> {
    const sdk = await this.getSdk();
    await sdk.developer.loadDevice({ loadDevice: msg });
  }

  public async removePin(): Promise<void> {
    const sdk = await this.getSdk();
    await sdk.developer.removePin({ body: undefined });
  }

  public async send(events: core.Event[]): Promise<void> {
    throw new Error("not implemented");
  }

  public async softReset(): Promise<void> {
    const sdk = await this.getSdk();
    await sdk.developer.softReset({ body: undefined });
  }

  public async wipe(): Promise<void> {
    const sdk = await this.getSdk();
    await sdk.developer.wipe({ body: undefined });
  }

  public async btcSupportsCoin(coin: core.Coin): Promise<boolean> {
    return true;
  }

  public async btcSupportsScriptType(coin: core.Coin, scriptType: core.BTCInputScriptType): Promise<boolean> {
    return true;
  }

  public async btcGetAddress(msg: core.BTCGetAddress): Promise<string> {
    const sdk = await this.getSdk();
    return sdk.wallet.btcGetAddress({ bTCGetAddress: msg });
  }

  public async btcSignTx(msg: core.BTCSignTxKK): Promise<core.BTCSignedTx> {
    const sdk = await this.getSdk();
    return sdk.sign.btcSignTx({ body: msg });
  }

  public async btcSupportsSecureTransfer(): Promise<boolean> {
    return false;
  }

  public btcSupportsNativeShapeShift(): boolean {
    return false;
  }

  public async ethSupportsEIP1559(): Promise<boolean> {
    return semver.gte(await this.getFirmwareVersion(), "v7.2.1");
  }

  public async btcSignMessage(msg: core.BTCSignMessage): Promise<core.BTCSignedMessage> {
    throw new Error("not implemented");
  }

  public async btcVerifyMessage(msg: core.BTCVerifyMessage): Promise<boolean> {
    throw new Error("not implemented");
  }

  public btcGetAccountPaths(msg: core.BTCGetAccountPaths): Array<core.BTCAccountPath> {
    throw new Error("not implemented");
  }

  public btcIsSameAccount(msg: Array<core.BTCAccountPath>): boolean {
    throw new Error("not implemented");
  }

  public async ethSignTx(msg: core.ETHSignTx): Promise<core.ETHSignedTx> {
    const sdk = await this.getSdk();
    return sdk.sign.ethSignTx({ body: msg });
  }

  // TODO check if sdk supports below messages

  public async ethGetAddress(msg: core.ETHGetAddress): Promise<string> {
    const sdk = await this.getSdk();
    return sdk.wallet.ethGetAddress({ eTHGetAddress: msg });
  }

  public async ethSignMessage(msg: core.ETHSignMessage): Promise<core.ETHSignedMessage> {
    throw new Error("WE NEED TO IMPLEMENT SEND PIN IN THE API & SDK");
  }

  public async ethSignTypedData(msg: core.ETHSignTypedData): Promise<core.ETHSignedTypedData> {
    throw new Error("not implemented");
  }

  public async ethVerifyMessage(msg: core.ETHVerifyMessage): Promise<boolean> {
    throw new Error("not implemented");
  }

  public async ethSupportsNetwork(chain_id: number): Promise<boolean> {
    throw new Error("not implemented");
  }

  public async ethSupportsSecureTransfer(): Promise<boolean> {
    throw new Error("not implemented");
  }

  public ethSupportsNativeShapeShift(): boolean {
    throw new Error("not implemented");
  }

  public ethGetAccountPaths(msg: core.ETHGetAccountPath): Array<core.ETHAccountPath> {
    throw new Error("not implemented");
  }

  public rippleGetAccountPaths(msg: core.RippleGetAccountPaths): Array<core.RippleAccountPath> {
    throw new Error("not implemented");
  }

  public async rippleGetAddress(msg: core.RippleGetAddress): Promise<string> {
    const sdk = await this.getSdk();
    return sdk.wallet.rippleGetAddress({ rippleGetAddress: msg });
  }

  public async rippleSignTx(msg: core.RippleSignTx): Promise<core.RippleSignedTx> {
    const sdk = await this.getSdk();
    return sdk.sign.rippleSignTx({ rippleSignTx: msg});
  }

  public cosmosGetAccountPaths(msg: core.CosmosGetAccountPaths): Array<core.CosmosAccountPath> {
    throw new Error("not implemented");
  }

  public async cosmosGetAddress(msg: core.CosmosGetAddress): Promise<string> {
    const sdk = await this.getSdk();
    return sdk.wallet.cosmosGetAddress({ cosmosGetAddress: msg });
  }

  public async cosmosSignTx(msg: core.CosmosSignTx): Promise<core.CosmosSignedTx> {
    const sdk = await this.getSdk();
    return sdk.sign.cosmosSignTx({ cosmosSignTx: msg });
  }

  public thorchainGetAccountPaths(msg: core.ThorchainGetAccountPaths): Array<core.ThorchainAccountPath> {
    throw new Error("not implemented");
  }

  public async thorchainGetAddress(msg: core.ThorchainGetAddress): Promise<string | null> {
    const sdk = await this.getSdk();
    return sdk.wallet.thorchainGetAddress({ thorchainGetAddress: msg });
  }

  public async thorchainSignTx(msg: core.ThorchainSignTx): Promise<core.ThorchainSignedTx> {
    const sdk = await this.getSdk();
    return sdk.sign.thorchainSignTx({ thorchainSignTx: msg });
  }

  public binanceGetAccountPaths(msg: core.BinanceGetAccountPaths): Array<core.BinanceAccountPath> {
    throw new Error("not implemented");
  }

  public async binanceGetAddress(msg: core.BinanceGetAddress): Promise<string> {
    const sdk = await this.getSdk();
    return sdk.wallet.binanceGetAddress({ binanceGetAddress: msg });
  }

  public async binanceSignTx(msg: core.BinanceSignTx): Promise<core.BinanceSignedTx> {
    const sdk = await this.getSdk();
    return sdk.sign.binanceSignTx({ body: msg });
  }

  public eosGetAccountPaths(msg: core.EosGetAccountPaths): Array<core.EosAccountPath> {
    throw new Error("not implemented");
  }

  public async eosGetPublicKey(msg: core.EosGetPublicKey): Promise<string> {
    const sdk = await this.getSdk();
    return sdk.wallet.eosGetPublicKey({ eosGetPublicKey: msg });
  }

  public async eosSignTx(msg: core.EosToSignTx): Promise<core.EosTxSigned> {
    const sdk = await this.getSdk();
    return sdk.sign.eosSignTx({ body: msg });
  }

  public describePath(msg: core.DescribePath): core.PathDescription {
    throw new Error("not implemented");
  }

  public async disconnect(): Promise<void> {
    const sdk = await this.getSdk();
    sdk.developer.disconnect({ body: undefined });
  }

  public btcNextAccountPath(msg: core.BTCAccountPath): core.BTCAccountPath | undefined {
    throw new Error("not implemented");
  }

  public ethNextAccountPath(msg: core.ETHAccountPath): core.ETHAccountPath | undefined {
    throw new Error("not implemented");
  }

  public eosNextAccountPath(msg: core.EosAccountPath): core.EosAccountPath | undefined {
    throw new Error("not implemented");
  }

  public cosmosNextAccountPath(msg: core.CosmosAccountPath): core.CosmosAccountPath | undefined {
    throw new Error("not implemented");
  }

  public rippleNextAccountPath(msg: core.RippleAccountPath): core.RippleAccountPath | undefined {
    throw new Error("not implemented");
  }

  public binanceNextAccountPath(msg: core.BinanceAccountPath): core.BinanceAccountPath | undefined {
    throw new Error("not implemented");
  }
}

export function info(): any {
  throw new Error("not implemented");
}

export function create(): KeepKeyRestHDWallet {
  return new KeepKeyRestHDWallet();
}
