import * as core from "@shapeshiftoss/hdwallet-core";

import { VultisigBftProvider, VultisigEvmProvider, VultisigSolanaProvider, VultisigUtxoProvider } from "./types";
import { VultisigHDWallet } from "./vultisig";

declare global {
  interface Window {
    vultisig?: {
      ethereum?: VultisigEvmProvider;
      bitcoin?: VultisigUtxoProvider;
      litecoin?: VultisigUtxoProvider;
      dogecoin?: VultisigUtxoProvider;
      bitcoincash?: VultisigUtxoProvider;
      zcash?: VultisigUtxoProvider;
      dash?: VultisigUtxoProvider;
      solana?: VultisigSolanaProvider;
      keplr?: VultisigBftProvider;
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
    const litecoinProvider = window.vultisig?.litecoin;
    const dogecoinProvider = window.vultisig?.dogecoin;
    const bitcoincashProvider = window.vultisig?.bitcoincash;
    const zcashProvider = window.vultisig?.zcash;
    const dashProvider = window.vultisig?.dash;
    const solanaProvider = window.vultisig?.solana;
    const thorchainProvider = window.vultisig?.keplr;
    const cosmosProvider = window.vultisig?.keplr;

    if (
      !evmProvider ||
      !bitcoinProvider ||
      !solanaProvider ||
      !litecoinProvider ||
      !dogecoinProvider ||
      !bitcoincashProvider ||
      !zcashProvider ||
      !dashProvider ||
      !thorchainProvider ||
      !cosmosProvider
    ) {
      window.open("https://vultisig.com/", "_blank");
      console.error("Please install Vultisig!");
      throw new Error("Vultisig provider not found");
    }

    const wallet = new VultisigHDWallet(
      evmProvider,
      bitcoinProvider,
      litecoinProvider,
      dogecoinProvider,
      bitcoincashProvider,
      zcashProvider,
      dashProvider,
      solanaProvider,
      thorchainProvider,
      cosmosProvider
    );
    await wallet.initialize();
    const deviceID = await wallet.getDeviceID();
    this.keyring.add(wallet, deviceID);
    this.keyring.emit(["Vultisig", deviceID, core.Events.CONNECT], deviceID);

    return wallet;
  }
}
