import WalletConnect from "@walletconnect/client";
import * as core from "@shapeshiftoss/hdwallet-core";
import * as ethers from "ethers";
import { convertHexToUtf8 } from "@walletconnect/utils";

const addressNList = core.bip32ToAddressNList("m/44'/60'/0'/0/0");

export class HDWalletWCBridge {
  private connector: WalletConnect;

  constructor(private readonly wallet: core.ETHWallet, uri: string) {
    this.connector = new WalletConnect({ uri });
  }

  async connect() {
    if (!this.wallet) throw new Error('Missing ETH Wallet to connect with');

    if (!this.connector.connected) {
      await this.connector.createSession();
    }

    this.subscribeToEvents();
  }

  private subscribeToEvents() {
    this.connector.on("session_request", async (error, payload) => {
      this.log('Session Request', {error, payload});

      const address = await this.wallet.ethGetAddress({ addressNList });
      this.connector.approveSession({
        chainId: payload.params[0].chainId ?? 4,
        accounts: [address!],
      });
    });
    this.connector.on("session_update", (error, payload) => {
      this.log('Session Update', {error, payload});
    });
    this.connector.on("call_request", async (error, payload) => {
      this.log('Call Request', {error, payload});

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
          result = await this.wallet.ethSignMessage({
            addressNList,
            message: this.convertHexToUtf8IfPossible(payload.params[0]),
          });
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

      if (!!result) {
        this.log('Approve Request', {payload, result});
        this.connector.approveRequest({ id: payload.id, result: result?.signature });
      } else {
        const message = "JSON RPC method not supported";
        this.log('Reject Request', {payload, message});
        this.connector.rejectRequest({ id: payload.id, error: { message } });
      }
    });
    this.connector.on("connect", (error, payload) => {
      this.log('Connect', {error, payload});
    });
    this.connector.on("disconnect", (error, payload) => {
      this.log('Disconnect', {error, payload});
    });
  }

  private log(eventName: string, properties: object) {
    console.log('WalletConnect Bridge', eventName, properties);
  }

  private convertHexToUtf8IfPossible(hex: string) {
    try {
      return convertHexToUtf8(hex);
    } catch (e) {
      return hex;
    }
  }
}
