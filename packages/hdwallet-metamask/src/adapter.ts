import detectEthereumProvider from "@metamask/detect-provider";
import MetaMaskOnboarding from "@metamask/onboarding";
import * as core from "@shapeshiftoss/hdwallet-core";

import { MetaMaskHDWallet } from "./metamask";

export class MetaMaskAdapter {
  keyring: core.Keyring;

  private constructor(keyring: core.Keyring) {
    this.keyring = keyring;
  }

  public static useKeyring(keyring: core.Keyring) {
    return new MetaMaskAdapter(keyring);
  }

  public async initialize(): Promise<number> {
    return Object.keys(this.keyring.wallets).length;
  }

  public async pairDevice(): Promise<MetaMaskHDWallet> {
    const provider: any = await detectEthereumProvider({ mustBeMetaMask: true, silent: false, timeout: 3000 });
    if (!provider) {
      const onboarding = new MetaMaskOnboarding();
      onboarding.startOnboarding();
      console.error("Please install MetaMask!");
    }
    try {
      await provider.request({ method: "eth_requestAccounts" });
    } catch (error) {
      console.error("Could not get MetaMask accounts. ");
      throw error;
    }
    const wallet = new MetaMaskHDWallet(provider);
    await wallet.initialize();
    const deviceID = await wallet.getDeviceID();
    this.keyring.add(wallet, deviceID);
    this.keyring.emit(["MetaMask", deviceID, core.Events.CONNECT], deviceID);

    return wallet;
  }
}
