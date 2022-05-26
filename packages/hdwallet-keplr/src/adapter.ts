import * as core from "@shapeshiftoss/hdwallet-core";

import { KeplrHDWallet } from "./keplr";

export class KeplrAdapter {
  keyring: core.Keyring;

  // wallet id to remove from the keyring when the active wallet changes
  currentDeviceID?: string;

  private constructor(keyring: core.Keyring) {
    this.keyring = keyring;
  }

  public static useKeyring(keyring: core.Keyring) {
    return new KeplrAdapter(keyring);
  }

  public async initialize(): Promise<number> {
    return Object.keys(this.keyring.wallets).length;
  }

  public async pairDevice(): Promise<core.HDWallet> {
    if (!window.getOfflineSigner || !window.keplr) {
      console.error("Please install Keplr Extension!");
    }
    const wallet = new KeplrHDWallet();
    await wallet.initialize();
    const deviceID = await wallet.getDeviceID();
    this.keyring.add(wallet, deviceID);
    this.currentDeviceID = deviceID;
    this.keyring.emit(["Keplr", deviceID, core.Events.CONNECT], deviceID);

    return wallet;
  }
}
