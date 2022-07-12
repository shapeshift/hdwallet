import * as core from "@shapeshiftoss/hdwallet-core";
import WalletConnect from "@walletconnect/client";
import { IWalletConnectSession } from "@walletconnect/types";
import { convertHexToUtf8 } from "@walletconnect/utils";

import { WalletConnectCallRequest, WalletConnectSessionRequestPayload } from "./types";

const addressNList = core.bip32ToAddressNList("m/44'/60'/0'/0/0");

export class HDWalletWCBridge {
  constructor(private readonly wallet: core.ETHWallet, private readonly connector: WalletConnect) {}

  static fromURI(uri: string, wallet: core.ETHWallet) {
    return new HDWalletWCBridge(wallet, new WalletConnect({ uri }));
  }

  static fromSession(session: IWalletConnectSession, wallet: core.ETHWallet) {
    return new HDWalletWCBridge(wallet, new WalletConnect({ session }));
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
    this.connector.on("disconnect", this._onDisonnect.bind(this));
    this.connector.on("call_request", this._onCallRequest.bind(this));
  }

  async _onSessionRequest(error: Error | null, payload: WalletConnectSessionRequestPayload) {
    this.log("Session Request", { error, payload });

    const address = await this.wallet.ethGetAddress({ addressNList });
    this.connector.approveSession({
      chainId: payload.params[0].chainId ?? 4,
      accounts: [address!],
    });
  }

  async _onSessionUpdate(error: Error | null, payload: any) {
    this.log("Session Update", { error, payload });
  }

  async _onConnect(error: Error | null, payload: any) {
    this.log("Connect", { error, payload });
  }

  async _onDisonnect(error: Error | null, payload: any) {
    this.log("Disonnect", { error, payload });
  }

  async _onCallRequest(error: Error | null, payload: WalletConnectCallRequest) {
    this.log("Call Request", { error, payload });

    let result: any;
    switch (payload.method) {
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
          addressNList,
          message: this.convertHexToUtf8IfPossible(payload.params[0]),
        });
        result = response?.signature;
        break;
      }
      case "eth_sendTransaction": {
        const tx = payload.params[0];
        const response = await this.wallet.ethSendTx?.({
          addressNList,
          chainId: tx.chainId,
          data: tx.data,
          gasLimit: tx.gasLimit,
          nonce: tx.nonce,
          to: tx.to,
          value: tx.value,
        });
        result = response?.hash;
        break;
      }
      case "eth_signTransaction": {
        const tx = payload.params[0];
        const response = await this.wallet.ethSignTx({
          addressNList,
          chainId: tx.chainId,
          data: tx.data,
          gasLimit: tx.gas,
          nonce: tx.nonce,
          to: tx.to,
          value: tx.value,
        });
        result = response?.serialized;
      }
    }

    if (result) {
      this.log("Approve Request", { payload, result });
      this.connector.approveRequest({ id: payload.id, result });
    } else {
      const message = "JSON RPC method not supported";
      this.log("Reject Request", { payload, message });
      this.connector.rejectRequest({ id: payload.id, error: { message } });
    }
  }

  private log(eventName: string, properties: object) {
    if (process.env.NODE_ENV !== "test") {
      console.log("WalletConnect Bridge", eventName, properties);
    }
  }

  private convertHexToUtf8IfPossible(hex: string) {
    try {
      return convertHexToUtf8(hex);
    } catch (e) {
      return hex;
    }
  }
}
