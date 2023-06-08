import CoinbaseWalletSDK from "@coinbase/wallet-sdk";
import * as core from "@shapeshiftoss/hdwallet-core";

import { CoinbaseHDWallet } from "./coinbase";

export type CoinbaseProviderConfig = {
  appName: string;
  appLogoUrl: string;
  defaultJsonRpcUrl: string;
  defaultChainId: number;
  darkMode: boolean;
};

export class CoinbaseAdapter {
  keyring: core.Keyring;
  providerConfig: CoinbaseProviderConfig;

  private constructor(keyring: core.Keyring, config: CoinbaseProviderConfig) {
    this.keyring = keyring;
    this.providerConfig = config;
  }

  public static useKeyring(keyring: core.Keyring, config: CoinbaseProviderConfig) {
    return new CoinbaseAdapter(keyring, config);
  }

  public async initialize(): Promise<number> {
    return Object.keys(this.keyring.wallets).length;
  }

  public async pairDevice(): Promise<CoinbaseHDWallet | undefined> {
    console.info("coinbase-wallet: pairDevice");
    // Initialize Coinbase Wallet SDK
    const coinbaseWallet = new CoinbaseWalletSDK({
      appName: this.providerConfig.appName,
      appLogoUrl: this.providerConfig.appLogoUrl,
      darkMode: this.providerConfig.darkMode,
    });

    // Initialize a Web3 Provider object
    const coinbaseWalletProvider = coinbaseWallet.makeWeb3Provider(
      this.providerConfig.defaultJsonRpcUrl,
      this.providerConfig.defaultChainId
    );

    try {
      await coinbaseWalletProvider.request?.({ method: "eth_requestAccounts" });
    } catch (err) {
      console.error("Could not get Coinbase accounts: ", err);
      throw err;
    }

    const wallet = new CoinbaseHDWallet(coinbaseWalletProvider);
    await wallet.initialize();
    const deviceID = await wallet.getDeviceID();

    this.keyring.add(wallet, deviceID);
    this.keyring.emit(["Coinbase", deviceID, core.Events.CONNECT], deviceID);

    return wallet;
  }
}
