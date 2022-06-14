import * as core from "@shapeshiftoss/hdwallet-core";
import WalletConnectProvider from "@walletconnect/web3-provider";

import { WalletConnectHDWallet } from "./walletconnect";

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

  public async pairDevice(provider: WalletConnectProvider): Promise<WalletConnectHDWallet> {
    try {
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
