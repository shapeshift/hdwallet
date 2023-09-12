import * as core from "@shapeshiftoss/hdwallet-core";
import { EthereumProvider } from "@walletconnect/ethereum-provider";
import { EthereumProviderOptions } from "@walletconnect/ethereum-provider/dist/types/EthereumProvider";

import { WalletConnectV2HDWallet } from "./walletconnectV2";

export class WalletConnectV2Adapter {
  keyring: core.Keyring;
  private readonly providerConfig: EthereumProviderOptions;

  private constructor(keyring: core.Keyring, config: EthereumProviderOptions) {
    this.keyring = keyring;
    this.providerConfig = config;
  }

  public static useKeyring(keyring: core.Keyring, config: EthereumProviderOptions) {
    return new WalletConnectV2Adapter(keyring, config);
  }

  public async initialize(): Promise<number> {
    return Object.keys(this.keyring.wallets).length;
  }

  public async pairDevice(): Promise<WalletConnectV2HDWallet> {
    try {
      if (!this.providerConfig) {
        throw new Error("WalletConnectV2 provider configuration not set.");
      }

      // TODO: Swap with UniversalProvider: https://docs.walletconnect.com/2.0/advanced/providers/universal
      const provider = await EthereumProvider.init(this.providerConfig);
      const wallet = new WalletConnectV2HDWallet(provider);

      //  Enable session (triggers QR Code modal)
      await wallet.initialize();
      const deviceID = await wallet.getDeviceID();
      this.keyring.add(wallet, deviceID);
      this.keyring.emit(["WalletConnect", deviceID, core.Events.CONNECT], deviceID); // TODO: emit "WalletConnectV2"?
      return wallet;
    } catch (error) {
      console.error("Could not pair WalletConnectV2");
      throw error;
    }
  }
}
