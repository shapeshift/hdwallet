import * as core from "@shapeshiftoss/hdwallet-core";
import { Address } from "@shapeshiftoss/hdwallet-core";
import Base64 from "base64-js";
import * as bitcoinMsg from "bitcoinjs-message";
import { keccak256, recoverAddress } from "ethers/lib/utils.js";
import isObject from "lodash/isObject";

import * as btc from "./bitcoin";
import * as cosmos from "./cosmos";
import * as eth from "./ethereum";
import { solanaSendTx, solanaSignTx } from "./solana";
import * as thorchain from "./thorchain";
import { VultisigEvmProvider, VultisigOfflineProvider, VultisigSolanaProvider, VultisigUtxoProvider } from "./types";

export function isVultisig(wallet: core.HDWallet): wallet is VultisigHDWallet {
  return isObject(wallet) && (wallet as any)._isVultisig;
}

export class VultisigHDWalletInfo
  implements
    core.HDWalletInfo,
    core.BTCWalletInfo,
    core.ETHWalletInfo,
    core.SolanaWalletInfo,
    core.ThorchainWalletInfo,
    core.CosmosWalletInfo
{
  // TODO(gomes): turn me back once signPSBT is fixed upstream
  readonly _supportsBTCInfo = false;
  readonly _supportsETHInfo = true;
  readonly _supportsSolanaInfo = true;
  readonly _supportsThorchainInfo = true;
  readonly _supportsCosmosInfo = true;

  constructor() {}

  public getVendor(): string {
    return "Vultisig";
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
    switch (msg.coin.toLowerCase()) {
      case "bitcoin": {
        // case "zcash": // case "bitcoincash": // case "dogecoin": // case "litecoin":
        const unknown = core.unknownUTXOPath(msg.path, msg.coin, msg.scriptType);

        if (!msg.scriptType) return unknown;
        if (!this.btcSupportsCoin(msg.coin)) return unknown;
        if (!this.btcSupportsScriptType(msg.coin, msg.scriptType)) return unknown;

        return core.describeUTXOPath(msg.path, msg.coin, msg.scriptType);
      }
      case "ethereum": {
        return core.describeETHPath(msg.path);
      }
      case "solana":
        return core.solanaDescribePath(msg.path);
      case "cosmos":
        return core.cosmosDescribePath(msg.path);
      case "thorchain":
        return core.thorchainDescribePath(msg.path);
      default:
        throw new Error(`Unsupported path for coin: ${msg.coin}`);
    }
  }

  /** Ethereum */

  public async ethSupportsNetwork(chainId = 1): Promise<boolean> {
    return chainId === 1;
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
    return eth.ethGetAccountPaths(msg);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public ethNextAccountPath(msg: core.ETHAccountPath): core.ETHAccountPath | undefined {
    console.error("Method not implemented");
    return undefined;
  }

  /** Bitcoin */

  public async btcSupportsCoin(coin: core.Coin): Promise<boolean> {
    const vultisigSupportedCoins = ["bitcoin"]; // Just BTC for first part of integration, we will enable it progressively
    return vultisigSupportedCoins.includes(coin.toLowerCase());
  }

  public async btcSupportsScriptType(coin: string, scriptType?: core.BTCInputScriptType | undefined): Promise<boolean> {
    if (!this.btcSupportsCoin(coin)) return false;

    const c = coin.toLowerCase();
    switch (scriptType) {
      case core.BTCInputScriptType.SpendAddress:
        return ["bitcoin"].includes(c);
      case core.BTCInputScriptType.SpendWitness:
        return ["bitcoin"].includes(c);
      default:
        return false;
    }
  }

  public async btcSupportsSecureTransfer(): Promise<boolean> {
    return false;
  }

  public btcSupportsNativeShapeShift(): boolean {
    return false;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public btcGetAccountPaths(msg: core.BTCGetAccountPaths): Array<core.BTCAccountPath> {
    return btc.btcGetAccountPaths(msg);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public btcNextAccountPath(msg: core.BTCAccountPath): core.BTCAccountPath | undefined {
    throw new Error("Method not implemented");
  }

  /** Solana */

  public solanaGetAccountPaths(msg: core.SolanaGetAccountPaths): Array<core.SolanaAccountPath> {
    return core.solanaGetAccountPaths(msg);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public solanaNextAccountPath(msg: core.SolanaAccountPath): core.SolanaAccountPath | undefined {
    throw new Error("Method not implemented");
  }

  public thorchainGetAccountPaths(msg: core.ThorchainGetAccountPaths): Array<core.ThorchainAccountPath> {
    return thorchain.thorchainGetAccountPaths(msg);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public thorchainNextAccountPath(msg: core.ThorchainAccountPath): core.ThorchainAccountPath | undefined {
    throw new Error("Method not implemented.");
  }

  public cosmosGetAccountPaths(msg: core.CosmosGetAccountPaths): Array<core.CosmosAccountPath> {
    return cosmos.cosmosGetAccountPaths(msg);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public cosmosNextAccountPath(_msg: core.CosmosAccountPath): core.CosmosAccountPath | undefined {
    throw new Error("Method not implemented.");
  }
}

export class VultisigHDWallet
  extends VultisigHDWalletInfo
  implements core.HDWallet, core.BTCWallet, core.ETHWallet, core.SolanaWallet, core.ThorchainWallet, core.CosmosWallet
{
  // TODO(gomes): turn me back once signPSBT is fixed upstream
  readonly _supportsBTC = false;
  readonly _supportsETH = true;
  readonly _supportsEthSwitchChain = true;
  readonly _supportsAvalanche = true;
  readonly _supportsOptimism = true;
  readonly _supportsPolygon = true;
  readonly _supportsGnosis = false;
  readonly _supportsArbitrum = true;
  readonly _supportsArbitrumNova = false;
  readonly _supportsBase = true;
  readonly _supportsMonad = false;
  readonly _supportsPlasma = false;
  readonly _supportsKatana = false;
  readonly _supportsHyperEvm = false;
  readonly _supportsBSC = true;
  readonly _supportsSolana = true;
  readonly _supportsThorchain = true;
  readonly _supportsCosmos = true;
  readonly _isVultisig = true;

  evmProvider: VultisigEvmProvider;
  bitcoinProvider: VultisigUtxoProvider;
  solanaProvider: VultisigSolanaProvider;
  thorchainProvider: VultisigOfflineProvider;
  cosmosProvider: VultisigOfflineProvider;

  ethAddress?: Address | null;

  constructor(providers: {
    evmProvider: VultisigEvmProvider;
    bitcoinProvider: VultisigUtxoProvider;
    solanaProvider: VultisigSolanaProvider;
    thorchainProvider: VultisigOfflineProvider;
    cosmosProvider: VultisigOfflineProvider;
  }) {
    super();

    this.evmProvider = providers.evmProvider;
    this.bitcoinProvider = providers.bitcoinProvider;
    this.solanaProvider = providers.solanaProvider;
    this.thorchainProvider = providers.thorchainProvider;
    this.cosmosProvider = providers.cosmosProvider;
  }

  transport?: core.Transport | undefined;

  public async getDeviceID(): Promise<string> {
    return "vultisig:" + (await this.getVault());
  }

  async getFeatures(): Promise<Record<string, any>> {
    return {};
  }

  public async getFirmwareVersion(): Promise<string> {
    return "vultisig";
  }

  public async getModel(): Promise<string> {
    return "Vultisig";
  }

  public async getLabel(): Promise<string> {
    return "Vultisig";
  }

  public async isInitialized(): Promise<boolean> {
    return true;
  }

  public async isLocked(): Promise<boolean> {
    return false;
  }

  public async clearSession(): Promise<void> {}

  public async initialize(): Promise<void> {}

  public async ping(msg: core.Ping): Promise<core.Pong> {
    return { msg: msg.msg };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async sendPin(pin: string): Promise<void> {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async sendPassphrase(passphrase: string): Promise<void> {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async sendCharacter(charater: string): Promise<void> {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async sendWord(word: string): Promise<void> {}

  public async cancel(): Promise<void> {}

  public async wipe(): Promise<void> {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async reset(msg: core.ResetDevice): Promise<void> {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async recover(msg: core.RecoverDevice): Promise<void> {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async loadDevice(msg: core.LoadDevice): Promise<void> {}

  public async disconnect(): Promise<void> {}

  public async getPublicKeys(msg: Array<core.GetPublicKey>): Promise<Array<core.PublicKey | null>> {
    return await Promise.all(
      msg.map(async (getPublicKey) => {
        const { coin, scriptType } = getPublicKey;

        if (scriptType !== undefined) {
          const isSupported = await this.btcSupportsScriptType(coin, scriptType);
          if (!isSupported) {
            return null;
          }
        }

        switch (coin) {
          case "Bitcoin": {
            // Note this is a pubKey, not an xpub, however vultisig does not support utxo derivation,
            // so this functions as an account (xpub) for all intents and purposes
            const pubKey = await this.btcGetAddress({ coin, scriptType } as core.BTCGetAddress);
            return { xpub: pubKey } as core.PublicKey;
          }
          default:
            break;
        }
        throw new Error("Vultisig does not support");
      })
    );
  }

  /** Ethereum */

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async ethGetAddress(_msg: core.ETHGetAddress): Promise<core.Address | null> {
    const address = await eth.ethGetAddress(this.evmProvider);

    if (address) {
      this.ethAddress = address;
      return address;
    } else {
      this.ethAddress = null;
      return null;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async ethSignTx(msg: core.ETHSignTx): Promise<core.ETHSignedTx | null> {
    console.error("Method not implemented");
    return null;
  }

  public async ethSendTx(msg: core.ETHSignTx): Promise<core.ETHTxHash | null> {
    const address = await this.ethGetAddress({ addressNList: [] });
    return address ? eth.ethSendTx(msg, this.evmProvider, address) : null;
  }

  public async ethSignMessage(msg: core.ETHSignMessage): Promise<core.ETHSignedMessage | null> {
    const address = await this.ethGetAddress({ addressNList: [] });
    return address ? eth.ethSignMessage(msg, this.evmProvider, address) : null;
  }

  async ethSignTypedData(msg: core.ETHSignTypedData): Promise<core.ETHSignedTypedData | null> {
    const address = await this.ethGetAddress({ addressNList: [] });
    return address ? eth.ethSignTypedData(msg, this.evmProvider, address) : null;
  }

  public async ethVerifyMessage(msg: core.ETHVerifyMessage): Promise<boolean | null> {
    if (!msg.signature.startsWith("0x")) msg.signature = `0x${msg.signature}`;
    const digest = keccak256(core.buildMessage(msg.message));
    return recoverAddress(digest, msg.signature) === msg.address;
  }

  public async ethGetChainId(): Promise<number | null> {
    return eth.ethGetChainId(this.evmProvider);
  }

  public async ethAddChain(params: core.AddEthereumChainParameter): Promise<void> {
    return eth.ethAddChain(this.evmProvider, params);
  }

  public async ethSwitchChain(params: core.AddEthereumChainParameter): Promise<void> {
    return eth.ethSwitchChain(this.evmProvider, params);
  }

  /** Bitcoin */

  public async btcGetAddress(msg: core.BTCGetAddress): Promise<string | null> {
    return btc.btcGetAddress(this.bitcoinProvider, msg);
  }

  public async btcSignTx(msg: core.BTCSignTx): Promise<core.BTCSignedTx | null> {
    const { coin } = msg;
    switch (coin) {
      case "Bitcoin":
        return btc.bitcoinSignTx(msg, this.bitcoinProvider);
      default:
        throw new Error("Vultisig does not support");
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async btcSignMessage(msg: core.BTCSignMessage): Promise<core.BTCSignedMessage | null> {
    throw new Error("not supported");
  }

  public async btcVerifyMessage(msg: core.BTCVerifyMessage): Promise<boolean | null> {
    const signature = Base64.fromByteArray(core.fromHexString(msg.signature));
    return bitcoinMsg.verify(msg.message, msg.address, signature);
  }

  /** get vault */

  public async getVault(): Promise<string | null> {
    const vault = await window.vultisig?.getVault();
    return vault?.uid || null;
  }

  /** Solana */

  public async solanaGetAddress(): Promise<string | null> {
    const { publicKey } = await this.solanaProvider.connect();
    return publicKey.toString();
  }

  public async solanaSignTx(msg: core.SolanaSignTx): Promise<core.SolanaSignedTx | null> {
    const address = await this.solanaGetAddress();
    return address ? solanaSignTx(msg, this.solanaProvider, address) : null;
  }

  public async solanaSendTx(msg: core.SolanaSignTx): Promise<core.SolanaTxSignature | null> {
    const address = await this.solanaGetAddress();
    return address ? solanaSendTx(msg, this.solanaProvider, address) : null;
  }

  /** THORChain */

  public async thorchainGetAddress(): Promise<string | null> {
    const address = await thorchain.thorchainGetAddress(this.thorchainProvider);
    return address || null;
  }

  public async thorchainSignTx(msg: core.ThorchainSignTx): Promise<core.ThorchainSignedTx | null> {
    return thorchain.thorchainSignTx(this.thorchainProvider, msg);
  }

  /** Cosmos */

  public async cosmosGetAddress(): Promise<string | null> {
    const address = await cosmos.cosmosGetAddress(this.cosmosProvider);
    return address || null;
  }

  public async cosmosSignTx(msg: core.CosmosSignTx): Promise<core.CosmosSignedTx | null> {
    return cosmos.cosmosSignTx(this.cosmosProvider, msg);
  }
}
