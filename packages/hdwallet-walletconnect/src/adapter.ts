import WalletConnectProvider from "@walletconnect/web3-provider";
import * as core from "@shapeshiftoss/hdwallet-core";

import { WalletConnectHDWallet } from "./walletconnect";

type WalletConnectConfig = {
  infuraId: string
} | { rpc: { [key: number]: string }}

export class WalletConnectAdapter {
  keyring: core.Keyring;

  private constructor(keyring: core.Keyring) {
    this.keyring = keyring;
  }

  public static useKeyring(keyring: core.Keyring) {
    return new WalletConnectAdapter(keyring);
  }

  public async initialize(): Promise<number> {
    return Object.keys(this.keyring.wallets).length;
  }

  public async pairDevice(config: WalletConnectConfig): Promise<WalletConnectHDWallet> {
    try {
      const provider = new WalletConnectProvider(config);
      const wallet = new WalletConnectHDWallet(provider);

      //  Enable session (triggers QR Code modal)
      await wallet.initialize();

      const deviceID = await wallet.getDeviceID();
      this.keyring.add(wallet, deviceID);
      this.keyring.emit(["WalletConnect", deviceID, core.Events.CONNECT], deviceID);
      return wallet;
    } catch (error) {
      console.error("Could not pair WalletConnect");
      throw error;
    }
  }
}
