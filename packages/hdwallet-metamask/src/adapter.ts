import * as core from "@shapeshiftoss/hdwallet-core";
import { MetaMaskHDWallet } from "./metamask";
import MetaMaskOnboarding from "@metamask/onboarding";

type MetaMaskWallet = any;

// Extend the global window object so that TS doesn't complain us trying to access the 'ethereum' property
declare global {
  interface Window {
    ethereum: any;
  }
}
const { ethereum } = window;

export class MetaMaskAdapter {
  keyring: core.Keyring;

  // wallet id to remove from the keyring when the active wallet changes
  currentDeviceID?: string;

  private constructor(keyring: core.Keyring) {
    this.keyring = keyring;
  }

  private isMetaMaskInstalled(): Boolean {
    return Boolean(ethereum && ethereum.isMetaMask);
  }

  public static useKeyring(keyring: core.Keyring) {
    return new MetaMaskAdapter(keyring);
  }

  public async initialize(): Promise<number> {
    return Object.keys(this.keyring.wallets).length;
  }

  public async pairDevice(): Promise<core.HDWallet> {
    if (!this.isMetaMaskInstalled()) {
      const onboarding = new MetaMaskOnboarding();
      onboarding.startOnboarding();
      console.error("Please install MetaMask!");
    }
    try {
      await ethereum.request({ method: "eth_requestAccounts" });
    } catch (error) {
      console.error("Could not get MetaMask accounts. ");
      throw error;
    }
    const wallet = new MetaMaskHDWallet();
    await wallet.initialize();
    const deviceID = await wallet.getDeviceID();
    this.keyring.add(wallet, deviceID);
    this.currentDeviceID = deviceID;
    this.keyring.emit(["MetaMask", deviceID, core.Events.CONNECT], deviceID);

    return wallet;
  }
}
