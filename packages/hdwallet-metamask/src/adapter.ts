import detectEthereumProvider from "@metamask/detect-provider";
import MetaMaskOnboarding from "@metamask/onboarding";
import * as core from "@shapeshiftoss/hdwallet-core";
import { providers } from "ethers";

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

  public async pairDevice(): Promise<MetaMaskHDWallet | undefined> {
    // TODO: remove casting, @metamask/detect-provider npm package hasn't been published with latest typings
    // https://github.com/MetaMask/detect-provider/blame/5ce916fc24779c4b36741531a41d9c8b3cbb0a17/src/index.ts#L37
    const provider = (await detectEthereumProvider({
      mustBeMetaMask: true,
      silent: false,
      timeout: 3000,
    })) as providers.ExternalProvider | null;
    if (!provider) {
      const onboarding = new MetaMaskOnboarding();
      onboarding.startOnboarding();
      console.error("Please install MetaMask!");
      throw new Error("MetaMask provider not found");
    }
    try {
      await provider.request?.({ method: "eth_requestAccounts" }).catch(() =>
        provider.request?.({
          method: "wallet_requestPermissions",
          params: [{ eth_accounts: {} }],
        })
      );
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
