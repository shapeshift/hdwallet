import * as core from "@shapeshiftoss/hdwallet-core";
import { XDeFiHDWallet } from "./xdefi";

export class XDeFiAdapter {
  keyring: core.Keyring;

  // wallet id to remove from the keyring when the active wallet changes
  currentDeviceID?: string;

  private constructor(keyring: core.Keyring) {
    this.keyring = keyring;
  }

  public static useKeyring(keyring: core.Keyring) {
    return new XDeFiAdapter(keyring);
  }

  public async initialize(): Promise<number> {
    return Object.keys(this.keyring.wallets).length;
  }

  public async pairDevice(): Promise<core.HDWallet> {
    const provider: any = (globalThis as any).xfi?.ethereum;
    if (!provider) {
      throw new Error("XDeFi provider not found");
    }
    try {
      await provider.request({ method: "eth_requestAccounts" });
    } catch (error) {
      console.error("Could not get XDeFi accounts. ");
      throw error;
    }
    const wallet = new XDeFiHDWallet();
    await wallet.initialize(provider);
    const deviceID = await wallet.getDeviceID();
    this.keyring.add(wallet, deviceID);
    this.currentDeviceID = deviceID;
    this.keyring.emit(["XDeFi", deviceID, core.Events.CONNECT], deviceID);

    return wallet;
  }
}
