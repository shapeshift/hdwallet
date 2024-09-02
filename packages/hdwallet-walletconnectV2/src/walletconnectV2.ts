import type {
  Coin,
  DescribePath,
  ETHAccountPath,
  ETHGetAccountPath,
  ETHSignedMessage,
  ETHSignedTx,
  ETHSignMessage,
  ETHSignTx,
  ETHSignTypedData,
  ETHTxHash,
  ETHVerifyMessage,
  ETHWallet,
  ETHWalletInfo,
  HDWallet,
  HDWalletInfo,
  PathDescription,
  Ping,
  Pong,
  PublicKey,
} from "@shapeshiftoss/hdwallet-core";
import { AddEthereumChainParameter, slip44ByCoin } from "@shapeshiftoss/hdwallet-core";
import EthereumProvider from "@walletconnect/ethereum-provider";
import isObject from "lodash/isObject";

import {
  describeETHPath,
  ethGetAddress,
  ethSendTx,
  ethSignMessage,
  ethSignTx,
  ethSignTypedData,
  ethVerifyMessage,
} from "./ethereum";

export function isWalletConnectV2(wallet: HDWallet): wallet is WalletConnectV2HDWallet {
  return isObject(wallet) && (wallet as any)._isWalletConnectV2;
}

/**
 * WalletConnect Wallet Info
 *
 * Supported JSON-RPC API Methods:
 * - personal_sign
 * - eth_sign
 * - eth_signTypedData
 * - eth_sendTransaction
 * - eth_signTransaction
 * - eth_sendRawTransaction
 * @see https://specs.walletconnect.com/2.0/blockchain-rpc/ethereum-rpc
 */
export class WalletConnectV2WalletInfo implements HDWalletInfo, ETHWalletInfo {
  readonly _supportsETHInfo = true;
  readonly _supportsBTCInfo = false;
  public getVendor(): string {
    return "WalletConnectV2";
  }

  public hasOnDevicePinEntry(): boolean {
    return false;
  }

  public hasOnDevicePassphrase(): boolean {
    return false;
  }

  public hasOnDeviceDisplay(): boolean {
    return false;
  }

  public hasOnDeviceRecovery(): boolean {
    return false;
  }

  public hasNativeShapeShift(): boolean {
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

  public describePath(msg: DescribePath): PathDescription {
    switch (msg.coin) {
      case "Ethereum":
        return describeETHPath(msg.path);
      default:
        throw new Error("Unsupported path");
    }
  }

  public ethNextAccountPath(): ETHAccountPath | undefined {
    return undefined;
  }

  public async ethSupportsNetwork(chainId: number): Promise<boolean> {
    return [1, 10, 56, 100, 137, 43114].includes(chainId);
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

  public ethGetAccountPaths(msg: ETHGetAccountPath): Array<ETHAccountPath> {
    const slip44 = slip44ByCoin(msg.coin);
    if (slip44 === undefined) return [];
    return [
      {
        addressNList: [0x80000000 + 44, 0x80000000 + slip44, 0x80000000 + msg.accountIdx, 0, 0],
        hardenedPath: [0x80000000 + 44, 0x80000000 + slip44, 0x80000000 + msg.accountIdx],
        relPath: [0, 0],
        description: "WalletConnectV2",
      },
    ];
  }
}

export class WalletConnectV2HDWallet implements HDWallet, ETHWallet {
  readonly _supportsETH = true;
  readonly _supportsETHInfo = true;
  readonly _supportsBTCInfo = false;
  readonly _supportsBTC = false;
  readonly _isWalletConnectV2 = true;
  readonly _supportsEthSwitchChain = true;
  readonly _supportsAvalanche = true;
  readonly _supportsOptimism = true;
  readonly _supportsBSC = true;
  readonly _supportsPolygon = true;
  readonly _supportsGnosis = true;
  readonly _supportsArbitrum = true;
  readonly _supportsArbitrumNova = true;
  readonly _supportsBase = true;

  info: WalletConnectV2WalletInfo & HDWalletInfo;
  provider: EthereumProvider;
  connected = false;
  chainId: number | undefined;
  accounts: string[] = [];
  ethAddress: string | undefined;

  constructor(provider: EthereumProvider) {
    this.provider = provider;
    this.info = new WalletConnectV2WalletInfo();
  }

  async getFeatures(): Promise<Record<string, any>> {
    return {};
  }

  public async isLocked(): Promise<boolean> {
    return false;
  }

  public getVendor(): string {
    return "WalletConnectV2";
  }

  public async getModel(): Promise<string> {
    return "WalletConnectV2";
  }

  public async getLabel(): Promise<string> {
    return "WalletConnectV2";
  }

  public async initialize(): Promise<void> {
    /** Display QR modal to connect */
    await this.provider.enable();
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

  public hasNativeShapeShift(srcCoin: Coin, dstCoin: Coin): boolean {
    return this.info.hasNativeShapeShift(srcCoin, dstCoin);
  }

  public supportsBip44Accounts(): boolean {
    return this.info.supportsBip44Accounts();
  }

  /**
   * Supports Offline Signing
   *
   * Offline signing is supported when `signTransaction` does not broadcast
   * the tx message. WalletConnect's core Connector implementation always
   * makes a request, so offline signing is not supported.
   */
  public supportsOfflineSigning(): boolean {
    return this.info.supportsOfflineSigning();
  }

  public supportsBroadcast(): boolean {
    return this.info.supportsBroadcast();
  }

  public async clearSession(): Promise<void> {
    await this.disconnect();
  }

  public async ping(msg: Ping): Promise<Pong> {
    return { msg: msg.msg };
  }

  public async sendPin(): Promise<void> {
    return;
  }

  public async sendPassphrase(): Promise<void> {
    return;
  }

  public async sendCharacter(): Promise<void> {
    return;
  }

  public async sendWord(): Promise<void> {
    return;
  }

  public async cancel(): Promise<void> {
    return;
  }

  public async wipe(): Promise<void> {
    return;
  }

  public async reset(): Promise<void> {
    return;
  }

  public async recover(): Promise<void> {
    return;
  }

  public async loadDevice(): Promise<void> {
    return;
  }

  public describePath(msg: DescribePath): PathDescription {
    return this.info.describePath(msg);
  }

  public async getPublicKeys(): Promise<Array<PublicKey | null>> {
    // Ethereum public keys are not exposed by the RPC API
    return [];
  }

  public async isInitialized(): Promise<boolean> {
    return true;
  }

  public async disconnect(): Promise<void> {
    await this.provider.disconnect();
  }

  public async ethSupportsNetwork(chainId = 1): Promise<boolean> {
    return this.info.ethSupportsNetwork(chainId);
  }

  public async ethSupportsSecureTransfer(): Promise<boolean> {
    return this.info.ethSupportsSecureTransfer();
  }

  public ethSupportsNativeShapeShift(): boolean {
    return this.info.ethSupportsNativeShapeShift();
  }

  public async ethSupportsEIP1559(): Promise<boolean> {
    return this.info.ethSupportsEIP1559();
  }

  public ethGetAccountPaths(msg: ETHGetAccountPath): Array<ETHAccountPath> {
    return this.info.ethGetAccountPaths(msg);
  }

  public ethNextAccountPath(): ETHAccountPath | undefined {
    return this.info.ethNextAccountPath();
  }

  public async ethGetAddress(): Promise<string | null> {
    if (this.ethAddress) {
      return this.ethAddress;
    }
    const address = await ethGetAddress(this.provider);
    if (address) {
      this.ethAddress = address;
      return address;
    } else {
      this.ethAddress = undefined;
      return null;
    }
  }

  /**
   * Ethereum Signed Transaction
   *
   * @see https://docs.walletconnect.com/client-api#sign-transaction-eth_signtransaction
   */
  public async ethSignTx(msg: ETHSignTx): Promise<ETHSignedTx | null> {
    if (!this.ethAddress) {
      throw new Error("No eth address");
    }
    return ethSignTx({ ...msg, from: this.ethAddress }, this.provider);
  }

  /**
   * Ethereum Send Transaction
   *
   * @see https://docs.walletconnect.com/client-api#send-transaction-eth_sendtransaction
   */
  public async ethSendTx(msg: ETHSignTx): Promise<ETHTxHash | null> {
    if (!this.ethAddress) {
      throw new Error("No eth address");
    }
    return ethSendTx({ ...msg, from: this.ethAddress }, this.provider);
  }

  /**
   * Ethereum Sign Message
   *
   * @see https://docs.walletconnect.com/advanced/multichain/rpc-reference/ethereum-rpc#eth_sign
   * */
  public async ethSignMessage(msg: ETHSignMessage): Promise<ETHSignedMessage | null> {
    if (!this.ethAddress) {
      throw new Error("No eth address");
    }
    return ethSignMessage({ data: msg.message, fromAddress: this.ethAddress }, this.provider);
  }

  /**
   * Ethereum Sign Typed Data
   *
   * @see https://docs.walletconnect.com/advanced/multichain/rpc-reference/ethereum-rpc#eth_signtypeddata
   */
  public async ethSignTypedData(msg: ETHSignTypedData): Promise<ETHSignedMessage | null> {
    if (!this.ethAddress) {
      throw new Error("No eth address");
    }
    return ethSignTypedData({ msg, fromAddress: this.ethAddress }, this.provider);
  }

  public async ethVerifyMessage(msg: ETHVerifyMessage): Promise<boolean | null> {
    return ethVerifyMessage(this.provider, msg);
  }

  public async getDeviceID(): Promise<string> {
    return "wc:" + (await this.ethGetAddress());
  }

  public async getFirmwareVersion(): Promise<string> {
    return "WalletConnectV2";
  }

  public async ethGetChainId(): Promise<number | null> {
    return this.provider.chainId;
  }

  public async ethSwitchChain({ chainId }: AddEthereumChainParameter): Promise<void> {
    const parsedChainId = parseInt(chainId, 16);
    if (isNaN(parsedChainId) || this.chainId === parsedChainId) {
      return;
    }

    await this.provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId }],
    });

    this.chainId = parsedChainId;
  }
}
