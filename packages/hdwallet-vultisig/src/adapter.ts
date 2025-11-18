import * as core from "@shapeshiftoss/hdwallet-core";

import {
  VultisigEvmProvider,
  VultisigGetVault,
  VultisigOfflineProvider,
  VultisigSolanaProvider,
  VultisigUtxoProvider,
} from "./types";
import { VultisigHDWallet } from "./vultisig";

declare global {
  interface Window {
    vultisig?: {
      getVault: () => Promise<VultisigGetVault>;
      ethereum?: VultisigEvmProvider;
      bitcoin?: VultisigUtxoProvider;
      solana?: VultisigSolanaProvider;
      keplr?: VultisigOfflineProvider;
    };
  }
}

export class VultisigAdapter {
  keyring: core.Keyring;

  private constructor(keyring: core.Keyring) {
    this.keyring = keyring;
  }

  public static useKeyring(keyring: core.Keyring) {
    return new VultisigAdapter(keyring);
  }

  public async initialize(): Promise<number> {
    return Object.keys(this.keyring.wallets).length;
  }

  public async pairDevice(): Promise<VultisigHDWallet | undefined> {
    const evmProvider = window.vultisig?.ethereum;
    const bitcoinProvider = window.vultisig?.bitcoin;
    const solanaProvider = window.vultisig?.solana;
    const thorchainProvider = window.vultisig?.keplr;
    const cosmosProvider = window.vultisig?.keplr;

    if (!evmProvider || !bitcoinProvider || !solanaProvider || !thorchainProvider || !cosmosProvider) {
      window.open("https://vultisig.com/", "_blank");
      console.error("Please install Vultisig!");
      throw new Error("Vultisig provider not found");
    }

    // Request authorization before accessing vault
    if (!evmProvider.request) {
      throw new Error("Vultisig EVM provider missing request method");
    }
    await evmProvider.request({ method: "eth_requestAccounts", params: [] });

    const wallet = new VultisigHDWallet({
      evmProvider,
      bitcoinProvider,
      solanaProvider,
      thorchainProvider,
      cosmosProvider,
    });
    await wallet.initialize();
    const deviceID = await wallet.getDeviceID();
    this.keyring.add(wallet, deviceID);
    this.keyring.emit(["Vultisig", deviceID, core.Events.CONNECT], deviceID);

    return wallet;
  }
}
