import * as core from "@shapeshiftoss/hdwallet-core";
import WalletConnect from '@walletconnect/client'
import { utils } from "ethers";

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
  readonly _supportsCosmosInfo = false;

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

  public supportsOfflineSigning(): boolean {
    return false;
  }

  public supportsBroadcast(): boolean {
    return true;
  }

  public describePath(msg: core.DescribePath): core.PathDescription {
    switch (msg.coin) {
      case "Ethereum":
        return core.describeETHPath(msg.path);
      default:
        throw new Error("Unsupported path");
    }
  }

  public ethNextAccountPath(_msg: core.ETHAccountPath): core.ETHAccountPath | undefined {
    // TODO: What do we do here?
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
    return true;
  }

  public ethGetAccountPaths(msg: core.ETHGetAccountPath): Array<core.ETHAccountPath> {
    return eth.ethGetAccountPaths(msg);
  }
}

export class WalletConnectHDWallet implements core.HDWallet, core.ETHWallet {
  readonly _supportsETH = true;
  readonly _supportsETHInfo = true;
  readonly _supportsBTCInfo = false;
  readonly _supportsBTC = false;
  readonly _supportsCosmosInfo = false;
  readonly _supportsCosmos = false;
  readonly _isWalletConnect = true;

  info: WalletConnectWalletInfo & core.HDWalletInfo;
  connector: WalletConnect;
  connected = false;
  chainId: number = -1;
  accounts: string[] = [];
  // TODO: confirm empty string doesn't break
  ethAddress: string = "";

  constructor(connector: WalletConnect) {
    this.info = new WalletConnectWalletInfo();
    this.connector = connector;
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
    this.connector.on("session_update", async (error, payload) => {
      console.log(`connector.on("session_update")`);

      if (error) {
        throw error;
      }

      const { chainId, accounts } = payload.params[0];
      this.onSessionUpdate(accounts, chainId);
    });

    this.connector.on("connect", (error, payload) => {
      console.log(`connector.on("connect")`);

      if (error) {
        throw error;
      }

      this.onConnect(payload);
    });

    this.connector.on("disconnect", (error) => {
      console.log(`connector.on("disconnect")`);

      if (error) {
        throw error;
      }

      this.onDisconnect();
    });

    if (this.connector.connected) {
      const { chainId, accounts } = this.connector;
      const [address] = accounts;
      this.setState({ connected: true, chainId, accounts, address });
      this.onSessionUpdate(accounts, chainId);
    }
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

  public supportsOfflineSigning(): boolean {
    return false;
  }

  public supportsBroadcast(): boolean {
    return true;
  }

  public async clearSession(): Promise<void> {
    // TODO: clear wallet connection
  }

  public async ping(msg: core.Ping): Promise<core.Pong> {
    // ping function for Wallet Connect? 
    return { msg: msg.msg };
  }

  public async sendPin(_pin: string): Promise<void> {
    // no concept of pin in WalletConnect
  }

  public async sendPassphrase(_passphrase: string): Promise<void> {
    // cannot send passphrase. Could show the widget?
  }

  public async sendCharacter(_charater: string): Promise<void> {
    // no concept of sendCharacter
  }

  public async sendWord(_word: string): Promise<void> {
    // no concept of sendWord
  }

  public async cancel(): Promise<void> {
    // no concept of cancel
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  public async wipe(): Promise<void> { }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  public async reset(_msg: core.ResetDevice): Promise<void> { }

  public async recover(_msg: core.RecoverDevice): Promise<void> {
    // no concept of recover
  }

  public async loadDevice(_msg: core.LoadDevice): Promise<void> {
    // TODO: Does WC allow this to be done programatically?
  }

  public describePath(msg: core.DescribePath): core.PathDescription {
    return this.info.describePath(msg);
  }

  public async getPublicKeys(_msg: Array<core.GetPublicKey>): Promise<Array<core.PublicKey | null>> {
    // Ethereum public keys are not exposed by the RPC API
    return [];
  }

  public async isInitialized(): Promise<boolean> {
    return true;
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  public async disconnect(): Promise<void> {
    return this.connector.killSession()
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
    return true;
  }

  public ethGetAccountPaths(msg: core.ETHGetAccountPath): Array<core.ETHAccountPath> {
    return eth.ethGetAccountPaths(msg);
  }

  public ethNextAccountPath(msg: core.ETHAccountPath): core.ETHAccountPath | undefined {
    return this.info.ethNextAccountPath(msg);
  }

  public async ethGetAddress(): Promise<string | null> {
    return this.ethAddress;
  }

  /**
   * Ethereum Signed Transaction
   * 
   * @see https://docs.walletconnect.com/client-api#sign-transaction-eth_signtransaction
   */
  public async ethSignTx(msg: core.ETHSignTx): Promise<core.ETHSignedTx | null> {
    // const address = await this.ethGetAddress();
    // return address ? eth.ethSignTx(msg, this.provider, address) : null;
    msg.gas = msg.gasLimit;
    msg.from = this.ethAddress;
    return this.connector.signTransaction(msg);
  }

  /**
   * Ethereum Send Transaction
   * 
   * @see https://docs.walletconnect.com/client-api#send-transaction-eth_sendtransaction
   */
  public async ethSendTx(msg: core.ETHSignTx): Promise<core.ETHTxHash | null> {
    // const address = await this.ethGetAddress();
    // return address ? eth.ethSendTx(msg, this.provider, address) : null;
    msg.from = this.ethAddress;
    return this.connector.sendTransaction(msg);
  }

  /**
   * Ethereum Sign Message
   * 
   * @see https://docs.walletconnect.com/client-api#sign-message-eth_sign
   */
  public async ethSignMessage(msg: core.ETHSignMessage): Promise<core.ETHSignedMessage | null> {
    // const address = await this.ethGetAddress();
    // return address ? eth.ethSignMessage(msg, this.provider, address) : null;
    return this.connector.signMessage([Buffer.from(msg.message).toString("hex"), this.ethAddress])
  }

  public async ethVerifyMessage(msg: core.ETHVerifyMessage): Promise<boolean | null> {
    // return eth.ethVerifyMessage(msg, this.provider);
    const hash = utils.hashMessage(msg)
  }

  public async getDeviceID(): Promise<string> {
    return "wc:" + (await this.ethGetAddress());
  }

  public async getFirmwareVersion(): Promise<string> {
    return "WalletConnect";
  }

  private onSessionUpdate(accounts: string[], chainId: number) {
    const [address] = accounts
    this.setState({ accounts, address, chainId })
  }

  private onConnect(payload: any) {
    const { accounts, chainId } = payload.params[0];
    const [address] = accounts;
    this.setState({ connected: true, chainId, accounts, address });
  }

  /**
   * onDisconnect
   * 
   * Resets state
   */
  private onDisconnect() {
    this.setState({ connected: false, chainId: 1, accounts: [], address: "" });
  }

  private setState(config: WCState) {
    const { connected, chainId, accounts, address } = config
    if(connected !== undefined) {
      this.connected = connected
    }
    this.chainId = chainId
    this.accounts = accounts
    this.ethAddress = address
  }
}