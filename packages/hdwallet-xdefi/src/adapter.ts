import * as core from "@keepkey/hdwallet-core";
import * as ethers from "ethers";

import { XDEFIHDWallet } from "./xdefi";

declare global {
  // https://stackoverflow.com/questions/59459312/using-globalthis-in-typescript
  // Global declarations require the use of var
  // eslint-disable-next-line no-var
  var xfi: { ethereum: ethers.providers.ExternalProvider } | null;
}

export class XDEFIAdapter {
  keyring: core.Keyring;

  // wallet id to remove from the keyring when the active wallet changes
  currentDeviceID?: string;

  private constructor(keyring: core.Keyring) {
    this.keyring = keyring;
  }

  public static useKeyring(keyring: core.Keyring) {
    return new XDEFIAdapter(keyring);
  }

  public async initialize(): Promise<number> {
    return Object.keys(this.keyring.wallets).length;
  }

  public async pairDevice(): Promise<XDEFIHDWallet | undefined> {
    const provider = globalThis.xfi?.ethereum;
    if (!provider) {
      console.error("Please install XDEFI!");
      throw new Error("XDEFI provider not found");
    }
    try {
      await provider.request?.({ method: "eth_requestAccounts" });
    } catch (error) {
      console.error("Could not get XDEFI accounts. ");
      throw error;
    }
    const wallet = new XDEFIHDWallet(provider);
    await wallet.initialize();
    const deviceID = await wallet.getDeviceID();
    this.keyring.add(wallet, deviceID);
    this.currentDeviceID = deviceID;
    this.keyring.emit(["XDEFI", deviceID, core.Events.CONNECT], deviceID);

    return wallet;
  }
}
