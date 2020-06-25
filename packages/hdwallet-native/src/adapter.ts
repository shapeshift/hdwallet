import * as core from "@shapeshiftoss/hdwallet-core";
import { create } from "./native";

type NativeAdapterArgs = {
  mnemonic: string;
  deviceId: string;
};

export class NativeAdapter {
  keyring: core.Keyring;
  deviceId: string;

  private mnemonic: string;

  private constructor(keyring: core.Keyring, args: NativeAdapterArgs) {
    this.keyring = keyring;
    this.mnemonic = args.mnemonic;
    this.deviceId = args.deviceId;
  }

  static useKeyring(keyring: core.Keyring, args: NativeAdapterArgs) {
    return new NativeAdapter(keyring, args);
  }

  async initialize(): Promise<number> {
    let wallet = this.keyring.get(this.deviceId);

    if (!wallet) {
      wallet = create(this.mnemonic, this.deviceId);
      this.keyring.add(wallet, this.deviceId);
    }

    wallet.initialize();

    return Object.keys(this.keyring.wallets).length;
  }

  async pairDevice(): Promise<core.HDWallet> {
    this.initialize();

    const wallet = this.keyring.get(this.deviceId);

    this.keyring.emit(
      [wallet.getVendor(), this.deviceId, core.Events.CONNECT],
      this.deviceId
    );

    return wallet;
  }
}
