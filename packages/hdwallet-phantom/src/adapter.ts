import * as core from "@shapeshiftoss/hdwallet-core";

import { PhantomHDWallet } from "./phantom";
import { PhantomEvmProvider, PhantomUtxoProvider } from "./types";

declare global {
  interface Window {
    ethereum?: PhantomEvmProvider;
    phantom?: {
      ethereum?: PhantomEvmProvider;
      bitcoin?: PhantomUtxoProvider;
      // TODO: update with proper types once implemented
      // https://github.com/anza-xyz/wallet-adapter/blob/3761cd8cc867da39da7c0b070bbf8779402cff36/packages/wallets/phantom/src/adapter.ts#L36
      solana?: any;
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
