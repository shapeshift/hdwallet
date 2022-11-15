import type { ChainId } from "@shapeshiftoss/caip";
import * as core from "@shapeshiftoss/hdwallet-core";
import { Logger } from "@shapeshiftoss/logger";
import SignClient from "@walletconnect/sign-client";
import { convertHexToUtf8 } from "@walletconnect/utils";

import {
  SessionDeleteEvent,
  SessionEventEvent,
  SessionPingEvent,
  SessionProposalEvent,
  SessionRequestEvent,
  WalletConnectCallRequestResponseMap,
  // WalletConnectSessionRequestPayload,
} from "./types";
import { addressNList, getAccountId } from "./utils";

export type HDWalletWCBridgeCallRequest = (request: SessionRequestEvent) => void;

export class HDWalletWCBridge {
  private logger = new Logger({ name: "HDWalletWCBridge", level: "debug" });

  constructor(
    private readonly wallet: core.ETHWallet,
    public readonly signClient: SignClient,
    private readonly chainId: ChainId,
    private readonly accountId: string | null,
    private readonly onCallRequest: HDWalletWCBridgeCallRequest,
    public topic?: string
  ) {}

  static async fromURI(
    uri: string,
    projectId: string,
    wallet: core.ETHWallet,
    chainId: ChainId,
    accountId: string | null,
    onCallRequest: HDWalletWCBridgeCallRequest
  ) {
    const signClient = await SignClient.init({
      projectId,
    });
    await signClient.core.pairing.pair({ uri });
    return new HDWalletWCBridge(wallet, signClient, chainId, accountId, onCallRequest);
  }

  // static fromSession(
  //   session: IWalletConnectSession,
  //   wallet: core.ETHWallet,
  //   chainId: ChainId,
  //   account: string | null,
  //   options?: HDWalletWCBridgeOptions
  // ) {
  //   return new HDWalletWCBridge(wallet, new WalletConnect({ session }), chainId, account, options);
  // }

  async connect() {
    this.subscribeToEvents();
  }

  async disconnect() {
    await this.signClient.pairing.disconnect({ topic: this.topic });
    this.signClient.off("session_proposal");
    this.signClient.off("session_event");
    this.signClient.off("session_request");
    this.signClient.off("session_ping");
    this.signClient.off("session_delete");
  }

  private subscribeToEvents() {
    this.signClient.on("session_proposal", async (event: SessionProposalEvent) => {
      // Show session proposal data to the user i.e. in a modal with options to approve / reject it
      const accountId = await getAccountId(this.wallet, this.accountId, this.chainId);
      const { topic, acknowledged } = await this.signClient.approve({
        id: event.id,
        namespaces: {
          eip155: {
            accounts: [accountId],
            methods: ["personal_sign", "eth_sendTransaction", "eth_signTransaction", "eth_sign", "eth_signTypedData"],
          },
        },
      });
      this.topic = topic;
      await acknowledged();
    });

    this.signClient.on("session_event", (event: SessionEventEvent) => {
      // Handle session events, such as "chainChanged", "accountsChanged", etc.
    });

    this.signClient.on("session_request", (event: SessionRequestEvent) => {
      // Handle session method requests, such as "eth_sign", "eth_sendTransaction", etc.
      this.onCallRequest(event);
    });

    this.signClient.on("session_ping", (event: SessionPingEvent) => {
      // React to session ping event
    });

    this.signClient.on("session_delete", (event: SessionDeleteEvent) => {
      // React to session delete event
      this.disconnect();
    });
  }

  // async _onSessionRequest(error: Error | null, payload: WalletConnectSessionRequestPayload) {
  //   this.log("Session Request", { error, payload });

  //   const address = this.accountId ?? (await this.wallet.ethGetAddress({ addressNList }));
  //   if (address) {
  //     this.signClient.approve({
  //       chainId: parseInt(this.chainId),
  //       accounts: [address],
  //     });
  //   }
  // }

  // async updateSession({ chainId, wallet, account }: { chainId: ChainId; wallet: core.ETHWallet; account?: string }) {
  //   const address = account ?? (await wallet.ethGetAddress({ addressNList }));
  //   if (address) {
  //     this.connector.updateSession({
  //       chainId: parseInt(chainId),
  //       accounts: [address],
  //     });
  //   }
  // }

  public async approveRequest(
    request: SessionRequestEvent,
    approveData?: Partial<WalletConnectCallRequestResponseMap[keyof WalletConnectCallRequestResponseMap]>
  ) {
    let result: any;
    switch (request.params.request.method) {
      // TODO: figure out what to do for "eth_sign" and "eth_signTypedData".
      // MetaMaskHDWallet's ethSignMessage calls "personal_sign"
      // and the other fns don't seem to be exposed on HDWallet
      case "eth_sign": {
        const response = await this.wallet.ethSignMessage({
          ...approveData,
          addressNList,
          message: this.convertHexToUtf8IfPossible(request.params.request.params[1]),
        });
        result = response?.signature;
        break;
      }
      case "eth_signTypedData": {
        break;
      }
      case "personal_sign": {
        const response = await this.wallet.ethSignMessage({
          ...approveData,
          addressNList,
          message: this.convertHexToUtf8IfPossible(request.params.request.params[0]),
        });
        result = response?.signature;
        break;
      }
      case "eth_sendTransaction": {
        const tx = request.params.request.params[0];
        const response = await this.wallet.ethSendTx?.({
          addressNList,
          chainId: parseInt(this.chainId),
          data: tx.data,
          gasLimit: tx.gas,
          nonce: tx.nonce,
          to: tx.to,
          value: tx.value,
          ...approveData,
        });
        result = response?.hash;
        break;
      }
      case "eth_signTransaction": {
        const tx = request.params.request.params[0];
        const response = await this.wallet.ethSignTx({
          addressNList,
          chainId: parseInt(this.chainId),
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
      this.signClient.respond({ topic: this.topic, response: { id: request.id, result } });
    } else {
      const message = "JSON RPC method not supported";
      this.log("Reject Request (catch)", { request, message });
      this.signClient.respond({ topic: this.topic, response: { id: request.id, error: { message } } });
    }
  }

  public async rejectRequest(request: SessionRequestEvent) {
    this.log("Reject Request", { request });
    this.signClient.respond({
      topic: this.topic,
      response: { id: request.id, error: { message: "Rejected by user" } },
    });
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
