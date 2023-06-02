import CoinbaseWalletSDK from "@coinbase/wallet-sdk";
import * as core from "@shapeshiftoss/hdwallet-core";

import { CoinbaseHDWallet } from "./coinbase";

export class CoinbaseAdapter {
  keyring: core.Keyring;

  private constructor(keyring: core.Keyring) {
    this.keyring = keyring;
  }

  public static useKeyring(keyring: core.Keyring) {
    return new CoinbaseAdapter(keyring);
  }

  public async initialize(): Promise<number> {
    return Object.keys(this.keyring.wallets).length;
  }

  public async pairDevice(): Promise<CoinbaseHDWallet | undefined> {
    console.info("coinbase-wallet: pairDevice");
    const APP_NAME = "ShapeShift";
    const APP_LOGO_URL = "https://avatars.githubusercontent.com/u/52928763?s=50&v=4";
    const DEFAULT_ETH_JSONRPC_URL = `https://mainnet.infura.io/v3/6e2f28ff4f5340fdb0db5da3baec0af2`;
    const DEFAULT_CHAIN_ID = 1;

    // Initialize Coinbase Wallet SDK
    const coinbaseWallet = new CoinbaseWalletSDK({
      appName: APP_NAME,
      appLogoUrl: APP_LOGO_URL,
      darkMode: false,
    });

    // Initialize a Web3 Provider object
    const coinbaseWalletProvider = coinbaseWallet.makeWeb3Provider(DEFAULT_ETH_JSONRPC_URL, DEFAULT_CHAIN_ID);

    // Initialize a Web3 object
    // const web3 = new Web3(coinbaseWalletProvider as any);

    try {
      const accts = (await coinbaseWalletProvider.request?.({ method: "eth_requestAccounts" })) as string[];
      console.info(`account address: ${accts[0]}`);
    } catch (err) {
      console.error(`Could not get Coinbase accounts: ${err}`);
      throw err;
    }

    const wallet = new CoinbaseHDWallet(coinbaseWalletProvider);
    await wallet.initialize();
    const deviceID = await wallet.getDeviceID();
    console.info(`deviceID: ${deviceID}`);

    this.keyring.add(wallet, deviceID);
    this.keyring.emit(["Coinbase", deviceID, core.Events.CONNECT], deviceID);
    // Optionally, have the default account set for web3.js
    // web3.eth.defaultAccount = accounts[0]

    return wallet;
  }
}
