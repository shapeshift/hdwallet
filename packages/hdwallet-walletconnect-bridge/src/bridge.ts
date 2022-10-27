import * as core from "@shapeshiftoss/hdwallet-core";
import { Logger } from "@shapeshiftoss/logger";
import WalletConnect from "@walletconnect/client";
import { IWalletConnectSession } from "@walletconnect/types";
import { convertHexToUtf8 } from "@walletconnect/utils";

import {
  WalletConnectCallRequest,
  WalletConnectCallRequestResponseMap,
  WalletConnectSessionRequestPayload,
} from "./types";

const addressNList = core.bip32ToAddressNList("m/44'/60'/0'/0/0");

export type HDWalletWCBridgeOptions = {
  onCallRequest(request: WalletConnectCallRequest): void;
};

export class HDWalletWCBridge {
  private logger = new Logger({ name: "HDWalletWCBridge", level: "debug" });

  constructor(
    private readonly wallet: core.ETHWallet,
    public readonly connector: WalletConnect,
    private readonly options?: HDWalletWCBridgeOptions
  ) {}

  static fromURI(uri: string, wallet: core.ETHWallet, options?: HDWalletWCBridgeOptions) {
    return new HDWalletWCBridge(wallet, new WalletConnect({ uri }), options);
  }

  static fromSession(session: IWalletConnectSession, wallet: core.ETHWallet, options?: HDWalletWCBridgeOptions) {
    return new HDWalletWCBridge(wallet, new WalletConnect({ session }), options);
  }

  async connect() {
    if (!this.wallet) throw new Error("Missing ETH Wallet to connect with");

    if (!this.connector.connected) {
      await this.connector.createSession();
    }

    this.subscribeToEvents();
  }

  async disconnect() {
    await this.connector.killSession();
    this.connector.off("session_request");
    this.connector.off("session_update");
    this.connector.off("connect");
    this.connector.off("disconnect");
    this.connector.off("call_request");
  }

  private subscribeToEvents() {
    this.connector.on("session_request", this._onSessionRequest.bind(this));
    this.connector.on("session_update", this._onSessionUpdate.bind(this));
    this.connector.on("connect", this._onConnect.bind(this));
    this.connector.on("disconnect", this._onDisconnect.bind(this));
    this.connector.on("call_request", this._onCallRequest.bind(this));
  }

  async _onSessionRequest(error: Error | null, payload: WalletConnectSessionRequestPayload) {
    this.log("Session Request", { error, payload });

    const address = await this.wallet.ethGetAddress({ addressNList });
    if (address) {
      this.connector.approveSession({
        chainId: payload.params[0].chainId ?? 4,
        accounts: [address],
      });
    }
  }

  async _onSessionUpdate(error: Error | null, payload: any) {
    this.log("Session Update", { error, payload });
  }

  async _onConnect(error: Error | null, payload: any) {
    this.log("Connect", { error, payload });
  }

  async _onDisconnect(error: Error | null, payload: any) {
    this.log("Disconnect", { error, payload });
  }

  async _onCallRequest(error: Error | null, payload: WalletConnectCallRequest) {
    this.log("Call Request", { error, payload });

    this.options?.onCallRequest(payload);
  }

  public async approveRequest(
    request: WalletConnectCallRequest,
    approveData?: Partial<WalletConnectCallRequestResponseMap[keyof WalletConnectCallRequestResponseMap]>
  ) {
    let result: any;
    switch (request.method) {
      // TODO: figure out what to do for "eth_sign" and "eth_signTypedData".
      // MetaMaskHDWallet's ethSignMessage calls "personal_sign"
      // and the other fns don't seem to be exposed on HDWallet
      case "eth_sign": {
        // result = await this.wallet.ethSignMessage({
        //   addressNList,
        //   message: payload.params[1],
        // });
        break;
      }
      case "eth_signTypedData": {
        break;
      }
      case "personal_sign": {
        const response = await this.wallet.ethSignMessage({
          ...approveData,
          addressNList,
          message: this.convertHexToUtf8IfPossible(request.params[0]),
        });
        result = response?.signature;
        break;
      }
      case "eth_sendTransaction": {
        const tx = request.params[0];
        const response = await this.wallet.ethSendTx?.({
          addressNList,
          chainId: tx.chainId,
          data: tx.data,
          gasLimit: tx.gasLimit,
          nonce: tx.nonce,
          to: tx.to,
          value: tx.value,
          ...approveData,
        });
        result = response?.hash;
        break;
      }
      case "eth_signTransaction": {
        const tx = request.params[0];
        const response = await this.wallet.ethSignTx({
          addressNList,
          chainId: tx.chainId,
          data: tx.data,
          gasLimit: tx.gas,
          nonce: tx.nonce,
          to: tx.to,
          value: tx.value,
          ...approveData,
        });
        result = response?.serialized;
      }
    }

    if (result) {
      this.log("Approve Request", { request, result });
      this.connector.approveRequest({ id: request.id, result });
    } else {
      const message = "JSON RPC method not supported";
      this.log("Reject Request (catch)", { request, message });
      this.connector.rejectRequest({ id: request.id, error: { message } });
    }
  }

  public async rejectRequest(request: WalletConnectCallRequest) {
    this.log("Reject Request", { request });
    this.connector.rejectRequest({ id: request.id, error: { message: "Rejected by user" } });
  }

  private log(eventName: string, properties: object) {
    this.logger.debug(properties, eventName);
  }

  private convertHexToUtf8IfPossible(hex: string) {
    try {
      return convertHexToUtf8(hex);
    } catch (e) {
      return hex;
    }
  }
}
