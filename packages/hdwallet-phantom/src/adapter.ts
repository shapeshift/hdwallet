import * as core from "@shapeshiftoss/hdwallet-core";
import { providers } from "ethers";

import { PhantomHDWallet } from "./phantom";

declare global {
  interface Window {
    phantom?: {
      ethereum?: providers.ExternalProvider;
    };
  }
}

export class PhantomAdapter {
  keyring: core.Keyring;

  private constructor(keyring: core.Keyring) {
    this.keyring = keyring;
  }

  public static useKeyring(keyring: core.Keyring) {
    return new PhantomAdapter(keyring);
  }

  public async initialize(): Promise<number> {
    return Object.keys(this.keyring.wallets).length;
  }

  public async pairDevice(): Promise<PhantomHDWallet | undefined> {
    const provider = window.phantom?.ethereum;

    if (!provider) {
      window.open("https://phantom.app/", "_blank");
      console.error("Please install Phantom!");
      throw new Error("Phantom provider not found");
    }

    try {
      await provider.request?.({ method: "eth_requestAccounts" }).catch(() =>
        provider.request?.({
          method: "wallet_requestPermissions",
          params: [{ eth_accounts: {} }],
        })
      );
    } catch (error) {
      console.error("Could not get Phantom accounts. ");
      throw error;
    }
    const wallet = new PhantomHDWallet(provider);
    await wallet.initialize();
    const deviceID = await wallet.getDeviceID();
    this.keyring.add(wallet, deviceID);
    this.keyring.emit(["Phantom", deviceID, core.Events.CONNECT], deviceID);

    return wallet;
  }
}
