import * as core from "@shapeshiftoss/hdwallet-core";

import { XDEFIHDWallet } from "./xdefi";

export class XDEFIAdapter {
  keyring: core.Keyring;

  // wallet id to remove from the keyring when the active wallet changes
  currentDeviceID?: string;

  private constructor(keyring: core.Keyring) {
    this.keyring = keyring;
  }

  public static useKeyring(keyring: core.Keyring) {
    return new XDEFIAdapter(keyring);
  }

  public async initialize(): Promise<number> {
    return Object.keys(this.keyring.wallets).length;
  }

  public async pairDevice(): Promise<XDEFIHDWallet> {
    const provider: any = (globalThis as any).xfi?.ethereum;
    if (!provider) {
      throw new Error("XDEFI provider not found");
    }
    try {
      await provider.request({ method: "eth_requestAccounts" });
    } catch (error) {
      console.error("Could not get XDEFI accounts. ");
      throw error;
    }
    const wallet = new XDEFIHDWallet(provider);
    await wallet.initialize();
    const deviceID = await wallet.getDeviceID();
    this.keyring.add(wallet, deviceID);
    this.currentDeviceID = deviceID;
    this.keyring.emit(["XDEFI", deviceID, core.Events.CONNECT], deviceID);

    return wallet;
  }
}
