import * as core from "@shapeshiftoss/hdwallet-core";
import { create, NativeHDWallet } from "./native";

export type NativeAdapterArgs = {
  mnemonic?: string;
  deviceId: string;
};

export class NativeAdapter {
  keyring: core.Keyring;
  deviceId: string;
  #mnemonic: string;

  private constructor(keyring: core.Keyring, args: NativeAdapterArgs) {
    this.keyring = keyring;
    this.deviceId = args.deviceId;
    this.#mnemonic = args.mnemonic;
  }

  static useKeyring(keyring: core.Keyring, args: NativeAdapterArgs) {
    return new NativeAdapter(keyring, args);
  }

  async initialize(): Promise<number> {
    let wallet = this.keyring.get<NativeHDWallet>(this.deviceId);

    if (!wallet) {
      wallet = create({ mnemonic: this.#mnemonic, deviceId: this.deviceId });
      this.keyring.add(wallet, this.deviceId);
      this.keyring.decorateEvents(this.deviceId, wallet.events);
    }

    if (this.#mnemonic) {
      wallet.initialize();
    }

    return Object.keys(this.keyring.wallets).length;
  }

  async pairDevice(): Promise<core.HDWallet> {
    await this.initialize();

    const wallet = this.keyring.get(this.deviceId);

    this.keyring.emit([wallet.getVendor(), this.deviceId, core.Events.CONNECT], this.deviceId);

    return wallet;
  }
}
