import * as core from "@keepkey/hdwallet-core";
import WalletConnectProvider from "@walletconnect/web3-provider";
import isObject from "lodash/isObject";

import * as eth from "./ethereum";

interface WCState {
  connected?: boolean;
  chainId: number;
  accounts: string[];
  address: string;
}

export function isWalletConnect(wallet: core.HDWallet): wallet is WalletConnectHDWallet {
  return isObject(wallet) && (wallet as any)._isWalletConnect;
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
export class WalletConnectWalletInfo implements core.HDWalletInfo, core.ETHWalletInfo {
  readonly _supportsETHInfo = true;
  readonly _supportsBTCInfo = false;
  public getVendor(): string {
    return "WalletConnect";
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

  public describePath(msg: core.DescribePath): core.PathDescription {
    switch (msg.coin) {
      case "Ethereum":
        return eth.describeETHPath(msg.path);
      default:
        throw new Error("Unsupported path");
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public ethNextAccountPath(_msg: core.ETHAccountPath): core.ETHAccountPath | undefined {
    return undefined;
  }

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
    return false;
  }

  public ethGetAccountPaths(msg: core.ETHGetAccountPath): Array<core.ETHAccountPath> {
    const slip44 = core.slip44ByCoin(msg.coin);
    if (slip44 === undefined) return [];
    return [
      {
        addressNList: [0x80000000 + 44, 0x80000000 + slip44, 0x80000000 + msg.accountIdx, 0, 0],
        hardenedPath: [0x80000000 + 44, 0x80000000 + slip44, 0x80000000 + msg.accountIdx],
        relPath: [0, 0],
        description: "WalletConnect",
      },
    ];
  }
}

export class WalletConnectHDWallet implements core.HDWallet, core.ETHWallet {
  readonly _supportsETH = true;
  readonly _supportsETHInfo = true;
  readonly _supportsBTCInfo = false;
  readonly _supportsBTC = false;
  readonly _isWalletConnect = true;
  readonly _supportsEthSwitchChain = false;
  readonly _supportsAvalanche = false;

  info: WalletConnectWalletInfo & core.HDWalletInfo;
  provider: WalletConnectProvider;
  connected = false;
  chainId = -1;
  accounts: string[] = [];
  ethAddress = "";

  constructor(provider: WalletConnectProvider) {
    this.provider = provider;
    this.info = new WalletConnectWalletInfo();
  }

  async getFeatures(): Promise<Record<string, any>> {
    return {};
  }

  public async isLocked(): Promise<boolean> {
    return false;
  }

  public getVendor(): string {
    return "WalletConnect";
  }

  public async getModel(): Promise<string> {
    return "WalletConnect";
  }

  public async getLabel(): Promise<string> {
    return "WalletConnect";
  }

  public async initialize(): Promise<void> {
    /** Subscribe to EIP-1193 events */
    this.provider.connector.on("session_update", async (error, payload) => {
      if (error) {
        throw error;
      }

      const { chainId, accounts } = payload.params[0];
      this.onSessionUpdate(accounts, chainId);
    });

    /** Note that this event does not fire on page reload */
    this.provider.connector.on("connect", (error, payload) => {
      if (error) {
        throw error;
      }

      this.onConnect(payload);
    });

    this.provider.connector.on("disconnect", (error) => {
      if (error) {
        throw error;
      }
      this.onDisconnect();
    });

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

  public hasNativeShapeShift(srcCoin: core.Coin, dstCoin: core.Coin): boolean {
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

  public async ping(msg: core.Ping): Promise<core.Pong> {
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
  public async reset(_msg: core.ResetDevice): Promise<void> {
    // no concept of reset
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async recover(_msg: core.RecoverDevice): Promise<void> {
    // no concept of recover
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async loadDevice(_msg: core.LoadDevice): Promise<void> {
    return;
  }

  public describePath(msg: core.DescribePath): core.PathDescription {
    return this.info.describePath(msg);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async getPublicKeys(_msg: Array<core.GetPublicKey>): Promise<Array<core.PublicKey | null>> {
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
    return chainId === 1;
  }

  public async ethSupportsSecureTransfer(): Promise<boolean> {
    return false;
  }

  public ethSupportsNativeShapeShift(): boolean {
    return false;
  }

  public async ethSupportsEIP1559(): Promise<boolean> {
    return false;
  }

  public ethGetAccountPaths(msg: core.ETHGetAccountPath): Array<core.ETHAccountPath> {
    return this.info.ethGetAccountPaths(msg);
  }

  public ethNextAccountPath(msg: core.ETHAccountPath): core.ETHAccountPath | undefined {
    return this.info.ethNextAccountPath(msg);
  }

  public async ethGetAddress(): Promise<string | null> {
    if (this.ethAddress) {
      return this.ethAddress;
    }
    const address = await eth.ethGetAddress(this.provider);
    if (address) {
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
  public async ethSignTx(msg: core.ETHSignTx): Promise<core.ETHSignedTx | null> {
    return eth.ethSignTx({ ...msg, from: this.ethAddress }, this.provider);
  }

  /**
   * Ethereum Send Transaction
   *
   * @see https://docs.walletconnect.com/client-api#send-transaction-eth_sendtransaction
   */
  public async ethSendTx(msg: core.ETHSignTx): Promise<core.ETHTxHash | null> {
    return eth.ethSendTx({ ...msg, from: this.ethAddress }, this.provider);
  }

  /**
   * Ethereum Sign Message
   *
   * @see https://docs.walletconnect.com/client-api#sign-message-eth_sign
   */
  public async ethSignMessage(msg: core.ETHSignMessage): Promise<core.ETHSignedMessage | null> {
    return eth.ethSignMessage({ data: msg.message, fromAddress: this.ethAddress }, this.provider);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async ethVerifyMessage(msg: core.ETHVerifyMessage): Promise<boolean | null> {
    console.error("Method ethVerifyMessage unsupported for WalletConnect wallet!");
    return null;
  }

  public async getDeviceID(): Promise<string> {
    return "wc:" + (await this.ethGetAddress());
  }

  public async getFirmwareVersion(): Promise<string> {
    return "WalletConnect";
  }

  private onConnect(payload: any) {
    const { accounts, chainId } = payload.params[0];
    const [address] = accounts;
    this.setState({ connected: true, chainId, accounts, address });
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
    this.setState({ connected: false, chainId: 1, accounts: [], address: "" });
  }

  private setState(config: WCState) {
    const { connected, chainId, accounts, address } = config;
    if (connected !== undefined) {
      this.connected = connected;
    }
    this.chainId = chainId;
    this.accounts = accounts;
    this.ethAddress = address;
  }
}
