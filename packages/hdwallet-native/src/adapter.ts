import * as core from "@shapeshiftoss/hdwallet-core";
import { create } from "./native";

export class NativeAdapter {
  keyring: core.Keyring;
  deviceId: string;

  private constructor(keyring: core.Keyring) {
    this.keyring = keyring;
    this.deviceId = "1";
  }

  public static useKeyring(keyring: core.Keyring) {
    return new NativeAdapter(keyring);
  }

  public async initialize(): Promise<number> {
    const wallet = create();
    console.log("wallet", wallet);
    this.keyring.add(wallet, this.deviceId);
    return Object.keys(this.keyring.wallets).length;
  }

  public async pairDevice(): Promise<core.HDWallet> {
    console.log("pairDevice");
    this.initialize();
    console.log("keyring", this.keyring);
    return this.keyring.get(this.deviceId);
  }
}
