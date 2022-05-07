import WalletConnect from "@walletconnect/client";
import QRCodeModal from "@walletconnect/qrcode-modal";
import * as core from "@shapeshiftoss/hdwallet-core";

import { WalletConnectHDWallet } from "./walletconnect";

export class WalletConnectAdapter {
  keyring: core.Keyring;

  private constructor(keyring: core.Keyring) {
    this.keyring = keyring;
  }

  public static useKeyring(keyring: core.Keyring) {
    return new WalletConnectAdapter(keyring);
  }

  public async initialize(): Promise<number> {
    return Object.keys(this.keyring.wallets).length;
  }

  public async pairDevice(): Promise<WalletConnectHDWallet> {

    const connector = new WalletConnect({
      bridge: "https://bridge.walletconnect.org", // Required
      qrcodeModal: QRCodeModal,
    });

    // Check if connection is already established
    if (!connector.connected) {
      // create new session
      await connector.createSession();
    }

    // Subscribe to connection events
    connector.on("connect", (error, payload) => {
      if (error) {
        throw error;
      }

      // Get provided accounts and chainId
      const { accounts, chainId } = payload.params[0];
    });

    const provider: any = await detectEthereumProvider({ mustBeMetaMask: true, silent: false, timeout: 3000 });
    
    try {
      await provider.request({ method: "eth_requestAccounts" });
    } catch (error) {
      console.error("Could not get MetaMask accounts. ");
      throw error;
    }
    const wallet = new WalletConnectHDWallet(provider);
    await wallet.initialize();
    const deviceID = await wallet.getDeviceID();
    this.keyring.add(wallet, deviceID);
    this.keyring.emit(["MetaMask", deviceID, core.Events.CONNECT], deviceID);

    return wallet;
  }
}
