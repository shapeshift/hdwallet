import * as core from "@shapeshiftoss/hdwallet-core";
import { providers } from "ethers";

import { PhantomHDWallet } from "./phantom";

declare global {
  interface Window {
    phantom?: {
      ethereum?: providers.ExternalProvider;
      bitcoin?: providers.ExternalProvider;
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
    const evmProvider = window.phantom?.ethereum;
    const bitcoinProvider = window.phantom?.bitcoin;

    if (!evmProvider || !bitcoinProvider) {
      window.open("https://phantom.app/", "_blank");
      console.error("Please install Phantom!");
      throw new Error("Phantom provider not found");
    }

    try {
      await evmProvider.request?.({ method: "eth_requestAccounts" }).catch(() =>
        evmProvider.request?.({
          method: "wallet_requestPermissions",
          params: [{ eth_accounts: {} }],
        })
      );
    } catch (error) {
      console.error("Could not get Phantom accounts. ");
      throw error;
    }
    const wallet = new PhantomHDWallet(evmProvider, bitcoinProvider);
    await wallet.initialize();
    const deviceID = await wallet.getDeviceID();
    this.keyring.add(wallet, deviceID);
    this.keyring.emit(["Phantom", deviceID, core.Events.CONNECT], deviceID);

    return wallet;
  }
}
