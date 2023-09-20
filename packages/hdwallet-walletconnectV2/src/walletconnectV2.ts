import type {
  Coin,
  DescribePath,
  ETHAccountPath,
  ETHGetAccountPath,
  ETHSignedMessage,
  ETHSignedTx,
  ETHSignMessage,
  ETHSignTx,
  ETHTxHash,
  ETHVerifyMessage,
  ETHWallet,
  ETHWalletInfo,
  GetPublicKey,
  HDWallet,
  HDWalletInfo,
  LoadDevice,
  PathDescription,
  Ping,
  Pong,
  PublicKey,
  RecoverDevice,
  ResetDevice,
} from "@shapeshiftoss/hdwallet-core";
import { slip44ByCoin } from "@shapeshiftoss/hdwallet-core";
import EthereumProvider from "@walletconnect/ethereum-provider";
import isObject from "lodash/isObject";

import * as eth from "./ethereum";

// FIXME: what is the actual state?
interface WCState {
  connected?: boolean;
  chainId: number;
  accounts?: string[];
  address?: string;
}

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
 * 🚧 eth_sendRawTransaction
 * @see https://docs.walletconnect.com/
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

  // FIXME
  public describePath(msg: DescribePath): PathDescription {
    switch (msg.coin) {
      case "Ethereum":
        return eth.describeETHPath(msg.path);
      default:
        throw new Error("Unsupported path");
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public ethNextAccountPath(_msg: ETHAccountPath): ETHAccountPath | undefined {
    return undefined;
  }

  // FIXME
  public async ethSupportsNetwork(chainId = 1): Promise<boolean> {
    return chainId === 1;
  }

  public async ethSupportsSecureTransfer(): Promise<boolean> {
    return false;
  }

  public ethSupportsNativeShapeShift(): boolean {
    return false;
  }

  // FIXME: confirm this is true
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
  readonly _supportsEthSwitchChain = false;
  readonly _supportsAvalanche = true;
  readonly _supportsOptimism = true;
  readonly _supportsBSC = true;
  readonly _supportsPolygon = true;
  readonly _supportsGnosis = true;

  info: WalletConnectV2WalletInfo & HDWalletInfo;
  provider: EthereumProvider;
  connected = false;
  chainId = -1; // FIXME: undefined?
  accounts: string[] = [];
  ethAddress = ""; // FIXME: undefined?

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

  // FIXME: flesh out?
  public async initialize(): Promise<void> {
    /** Subscribe to EIP-1193 events */
    this.provider.on("session_event", async (args) => {
      // const { chainId, event } = args.params;
      // this.onSessionUpdate(chainId);
    });

    /** Note that this event does not fire on page reload */
    this.provider.on("connect", (args) => {
      const { chainId } = args;
      this.setState({ connected: true, chainId: parseInt(chainId, 10) });
    });

    // FIXME: error is always defined?
    this.provider.on("disconnect", (error) => {
      if (error) {
        throw error;
      }
      this.onDisconnect();
    });

    // TODO
    this.provider.on("message", (args) => {});
    this.provider.on("chainChanged", (args) => {});
    this.provider.on("accountsChanged", (args) => {});
    this.provider.on("session_event", (args) => {});
    this.provider.on("session_delete", (args) => {});
    this.provider.on("session_update", (args) => {});
    this.provider.on("display_uri", (args) => {});

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
   * @see https://github.com/WalletConnect/walletconnect-monorepo/blob/7573fa9e1d91588d4af3409159b4fd2f9448a0e2/packages/clients/core/src/index.ts#L630
   */
  public supportsOfflineSigning(): boolean {
    return false;
  }

  public supportsBroadcast(): boolean {
    return true;
  }

  public async clearSession(): Promise<void> {
    await this.disconnect();
  }

  public async ping(msg: Ping): Promise<Pong> {
    // ping function for Wallet Connect?
    return { msg: msg.msg };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async sendPin(_pin: string): Promise<void> {
    // no concept of pin in WalletConnect
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async sendPassphrase(_passphrase: string): Promise<void> {
    // cannot send passphrase. Could show the widget?
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async sendCharacter(_character: string): Promise<void> {
    // no concept of sendCharacter
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async sendWord(_word: string): Promise<void> {
    // no concept of sendWord
  }

  public async cancel(): Promise<void> {
    // no concept of cancel
  }

  public async wipe(): Promise<void> {
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async reset(_msg: ResetDevice): Promise<void> {
    // no concept of reset
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async recover(_msg: RecoverDevice): Promise<void> {
    // no concept of recover
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async loadDevice(_msg: LoadDevice): Promise<void> {
    return;
  }

  public describePath(msg: DescribePath): PathDescription {
    return this.info.describePath(msg);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async getPublicKeys(_msg: Array<GetPublicKey>): Promise<Array<PublicKey | null>> {
    // Ethereum public keys are not exposed by the RPC API
    return [];
  }

  public async isInitialized(): Promise<boolean> {
    return true;
  }

  public async disconnect(): Promise<void> {
    await this.provider.disconnect();
  }

  // FIXME
  public async ethSupportsNetwork(chainId = 1): Promise<boolean> {
    return chainId === 1;
  }

  public async ethSupportsSecureTransfer(): Promise<boolean> {
    return false;
  }

  public ethSupportsNativeShapeShift(): boolean {
    return false;
  }

  // FIXME?
  public async ethSupportsEIP1559(): Promise<boolean> {
    return false;
  }

  public ethGetAccountPaths(msg: ETHGetAccountPath): Array<ETHAccountPath> {
    return this.info.ethGetAccountPaths(msg);
  }

  public ethNextAccountPath(msg: ETHAccountPath): ETHAccountPath | undefined {
    return this.info.ethNextAccountPath(msg);
  }

  public async ethGetAddress(): Promise<string | null> {
    if (this.ethAddress) {
      return this.ethAddress;
    }
    const address = await eth.ethGetAddress(this.provider);
    if (address) {
      // FIXME: why does a getter set something?
      this.ethAddress = address;
      return address;
    } else {
      this.ethAddress = "";
      return null;
    }
  }

  /**
   * Ethereum Signed Transaction
   *
   * @see https://docs.walletconnect.com/client-api#sign-transaction-eth_signtransaction
   */
  public async ethSignTx(msg: ETHSignTx): Promise<ETHSignedTx | null> {
    return eth.ethSignTx({ ...msg, from: this.ethAddress }, this.provider);
  }

  /**
   * Ethereum Send Transaction
   *
   * @see https://docs.walletconnect.com/client-api#send-transaction-eth_sendtransaction
   */
  public async ethSendTx(msg: ETHSignTx): Promise<ETHTxHash | null> {
    return eth.ethSendTx({ ...msg, from: this.ethAddress }, this.provider);
  }

  /**
   * Ethereum Sign Message
   *
   * @see https://docs.walletconnect.com/client-api#sign-message-eth_sign
   */
  public async ethSignMessage(msg: ETHSignMessage): Promise<ETHSignedMessage | null> {
    return eth.ethSignMessage({ data: msg.message, fromAddress: this.ethAddress }, this.provider);
  }

  public async ethVerifyMessage(msg: ETHVerifyMessage): Promise<boolean | null> {
    return eth.ethVerifyMessage(this.provider, msg);
  }

  public async getDeviceID(): Promise<string> {
    return "wc:" + (await this.ethGetAddress());
  }

  public async getFirmwareVersion(): Promise<string> {
    return "WalletConnectV2";
  }

  private onSessionUpdate(accounts: string[], chainId: number) {
    const [address] = accounts;
    this.setState({ accounts, address, chainId });
  }

  /**
   * onDisconnect
   *
   * Resets state.
   */
  private onDisconnect() {
    // FIXME: chinaId set to 1?
    this.setState({ connected: false, chainId: 1, accounts: [], address: "" });
  }

  private setState(config: WCState) {
    const { connected, chainId } = config;
    if (connected !== undefined) {
      this.connected = connected;
    }
    this.chainId = chainId;
    // this.accounts = accounts;
    // this.ethAddress = address;
  }
}
