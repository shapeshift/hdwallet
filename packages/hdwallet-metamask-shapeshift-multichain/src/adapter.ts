import * as core from "@shapeshiftoss/hdwallet-core";
import { enableShapeShiftSnap, shapeShiftSnapInstalled } from "@shapeshiftoss/metamask-snaps-adapter";
import { createStore } from "mipd";

import { SNAP_ID } from "./common";
import { MetaMaskShapeShiftMultiChainHDWallet } from "./shapeshift-multichain";

const store = createStore();

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

  public async pairDevice(): Promise<MetaMaskShapeShiftMultiChainHDWallet | undefined> {
    const maybeEip6963Provider = store.findProvider({ rdns: this.providerRdns });
    if (!maybeEip6963Provider) throw new Error("EIP-6963 provider not found");
    const eip1193Provider = maybeEip6963Provider.provider;

    // Checks if the EIP-6963 provider is *akschual* MetaMask
    // This assumes that the wallet supports EIP-6963, which all major wallets do
    const isMetaMask = maybeEip6963Provider.info.rdns === "io.metamask";

    if (isMetaMask && !shapeShiftSnapInstalled(SNAP_ID)) {
      console.info("ShapeShift Multichain snap not found. Prompting user to install.");
      const result = await enableShapeShiftSnap(SNAP_ID);
      if (result.success === false) {
        throw new Error("Could not install ShapeShift Multichain snap");
      }
    }
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
    const wallet = new MetaMaskShapeShiftMultiChainHDWallet(eip1193Provider);
    await wallet.initialize();
    const deviceID = await wallet.getDeviceID();
    this.keyring.add(wallet, deviceID);
    this.keyring.emit(["MetaMask(ShapeShift Multichain)", deviceID, core.Events.CONNECT], deviceID);

    return wallet;
  }
}
