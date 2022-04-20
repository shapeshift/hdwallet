import detectEthereumProvider from "@metamask/detect-provider";
import * as core from "@shapeshiftoss/hdwallet-core";
import TallyOnboarding from "tallyho-onboarding";

import { TallyHDWallet } from "./tally";

export class TallyAdapter {
  keyring: core.Keyring;

  // wallet id to remove from the keyring when the active wallet changes
  currentDeviceID?: string;

  private constructor(keyring: core.Keyring) {
    this.keyring = keyring;
  }

  public static useKeyring(keyring: core.Keyring) {
    return new TallyAdapter(keyring);
  }

  public async initialize(): Promise<number> {
    return Object.keys(this.keyring.wallets).length;
  }

  public async pairDevice(): Promise<TallyHDWallet> {
    const provider: any = await detectEthereumProvider({ mustBeMetaMask: false, silent: true, timeout: 3000 });
    if (!provider) {
      const onboarding = new TallyOnboarding();
      onboarding.startOnboarding();
      console.error("Please install Tally!");
    }
    if (provider == null) {
      throw new Error("Could not get Tally accounts.");
    }

    try {
      await provider.request({ method: "eth_requestAccounts" });
    } catch (error) {
      console.error("Could not get Tally accounts.");
      throw error;
    }
    const wallet = new TallyHDWallet(provider);
    await wallet.initialize();
    const deviceID = await wallet.getDeviceID();
    this.keyring.add(wallet, deviceID);
    this.currentDeviceID = deviceID;
    this.keyring.emit(["Tally", deviceID, core.Events.CONNECT], deviceID);

    return wallet;
  }
}
