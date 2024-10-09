import MetaMaskOnboarding from "@metamask/onboarding";
import * as core from "@shapeshiftoss/hdwallet-core";
import { createStore } from "mipd";

import { MetaMaskMultiChainHDWallet } from "./shapeshift-multichain";

export const mipdstore = createStore();

const METAMASK_RDNS = "io.metamask";

export class MetaMaskAdapter {
  keyring: core.Keyring;
  providerRdns: string;

  private constructor(keyring: core.Keyring, providerRdns: string) {
    this.keyring = keyring;
    this.providerRdns = providerRdns;
  }

  public static useKeyring(keyring: core.Keyring, providerRdns: string) {
    return new MetaMaskAdapter(keyring, providerRdns);
  }

  public async initialize(): Promise<number> {
    return Object.keys(this.keyring.wallets).length;
  }

  public async pairDevice(): Promise<MetaMaskMultiChainHDWallet | undefined> {
    const maybeEip6963Provider = mipdstore.findProvider({ rdns: this.providerRdns });
    if (!maybeEip6963Provider && this.providerRdns === METAMASK_RDNS) {
      const onboarding = new MetaMaskOnboarding();
      onboarding.startOnboarding();
      console.error("Please install MetaMask!");
      throw new Error("MetaMask provider not found");
    }
    // If we were only dealing with *detected* rdns, this would never happen, however
    // web contains a static list of rdns we want to display at all times to indicate support to users
    // Meaning we may hit this without the wallet actually being installed
    if (!maybeEip6963Provider) throw new Error("EIP-6963 provider not found");
    const eip1193Provider = maybeEip6963Provider.provider;

    try {
      await eip1193Provider.request?.({ method: "eth_requestAccounts" }).catch(() =>
        eip1193Provider.request?.({
          method: "wallet_requestPermissions",
          params: [{ eth_accounts: {} }],
        })
      );
    } catch (error) {
      console.error("Could not get MetaMask accounts. ");
      throw error;
    }
    const wallet = new MetaMaskMultiChainHDWallet(maybeEip6963Provider);
    await wallet.initialize();
    const deviceID = await wallet.getDeviceID();
    this.keyring.add(wallet, deviceID);
    this.keyring.emit(["MetaMask(ShapeShift Multichain)", deviceID, core.Events.CONNECT], deviceID);

    return wallet;
  }
}
