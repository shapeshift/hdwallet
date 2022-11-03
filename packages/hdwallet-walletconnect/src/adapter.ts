import * as core from "@shapeshiftoss/hdwallet-core";
import WalletConnectProvider from "@walletconnect/web3-provider";

import { WalletConnectHDWallet } from "./walletconnect";

export type WalletConnectProviderConfig =
  | {
      infuraId: string;
    }
  | { rpc: { [key: number]: string } };

export class WalletConnectAdapter {
  keyring: core.Keyring;
  private providerConfig: WalletConnectProviderConfig;

  private constructor(keyring: core.Keyring, config: WalletConnectProviderConfig) {
    this.keyring = keyring;
    this.providerConfig = config;
  }

  public static useKeyring(keyring: core.Keyring, config: WalletConnectProviderConfig) {
    return new WalletConnectAdapter(keyring, config);
  }

  public async initialize(): Promise<number> {
    return Object.keys(this.keyring.wallets).length;
  }

  public async pairDevice(): Promise<WalletConnectHDWallet> {
    try {
      if (!this.providerConfig) {
        throw new Error("WalletConnect provider configuration not set.");
      }
      const provider = new WalletConnectProvider(this.providerConfig);
      const wallet = new WalletConnectHDWallet(provider);

      //  Enable session (triggers QR Code modal)
      await wallet.initialize();
      const deviceID = await wallet.getDeviceID();
      this.keyring.add(wallet, deviceID);
      this.keyring.emit(["WalletConnect", deviceID, core.Events.CONNECT], deviceID);
      let disconnectedB = false;
      provider.connector.on("disconnect", (error) => {
        if (error) {
          throw error;
        }
        if (!disconnectedB) {
          disconnectedB = true;
          console.info("adapter.ts: received disconnect, emitting DISCONNECT event");
          this.keyring.emit(["WalletConnect", deviceID, core.Events.DISCONNECT], deviceID);
        } else {
          console.warn(`already disconnected wallet ${deviceID}`);
        }
      });

      return wallet;
    } catch (error) {
      console.error("Could not pair WalletConnect");
      throw error;
    }
  }
}
