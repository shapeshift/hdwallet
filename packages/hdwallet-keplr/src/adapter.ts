import * as core from "@shapeshiftoss/hdwallet-core";
import { KeplrHDWallet } from "./keplr";
import MetaMaskOnboarding from "@metamask/onboarding";
import detectEthereumProvider from "@metamask/detect-provider";

export class MetaMaskAdapter {
  keyring: core.Keyring;

  // wallet id to remove from the keyring when the active wallet changes
  currentDeviceID?: string;

  private constructor(keyring: core.Keyring) {
    this.keyring = keyring;
  }

  public static useKeyring(keyring: core.Keyring) {
    return new MetaMaskAdapter(keyring);
  }

  public async initialize(): Promise<number> {
    return Object.keys(this.keyring.wallets).length;
  }

  public async pairDevice(): Promise<core.HDWallet> {
    const provider: any = await detectEthereumProvider({ mustBeMetaMask: true, silent: false, timeout: 3000 });
    if (!provider) {
      const onboarding = new MetaMaskOnboarding();
      onboarding.startOnboarding();
      console.error("Please install MetaMask!");
    }
    try {
      await provider.request({ method: "eth_requestAccounts" });
    } catch (error) {
      console.error("Could not get Keplr accounts. ");
      throw error;
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
