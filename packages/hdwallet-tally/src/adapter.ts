import detectEthereumProvider from "@metamask/detect-provider";
import * as core from "@shapeshiftoss/hdwallet-core";
import TallyHoOnboarding from "tallyho-onboarding";

import { TallyHoHDWallet } from "./tallyho";

export class TallyHoAdapter {
  keyring: core.Keyring;

  private constructor(keyring: core.Keyring) {
    this.keyring = keyring;
  }

  public static useKeyring(keyring: core.Keyring) {
    return new TallyHoAdapter(keyring);
  }

  public async initialize(): Promise<void> {
    // no initialization needed
  }

  public async pairDevice(): Promise<TallyHoHDWallet> {
    const provider: any = await detectEthereumProvider({ mustBeMetaMask: false, silent: true, timeout: 3000 });
    if (!provider) {
      const onboarding = new TallyHoOnboarding();
      onboarding.startOnboarding();
      console.error("Please install Tally Ho!");
    }
    if (provider === null) {
      throw new Error("Could not get Tally Ho accounts.");
    }

    // eslint-disable-next-line no-useless-catch
    try {
      await provider.request({ method: "eth_requestAccounts" });
    } catch (error) {
      throw error;
    }
    const wallet = new TallyHoHDWallet(provider);
    await wallet.initialize();
    const deviceID = await wallet.getDeviceID();
    this.keyring.add(wallet, deviceID);
    this.keyring.emit(["Tally Ho", deviceID, core.Events.CONNECT], deviceID);

    return wallet;
  }
}
