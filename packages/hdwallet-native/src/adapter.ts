import * as core from "@shapeshiftoss/hdwallet-core";

import * as native from "./native";
import * as Isolation from "./crypto/isolation";

export type NativeAdapterArgs = {
  mnemonic?: string | Isolation.BIP39.Mnemonic;
  deviceId: string;
};

export class NativeAdapter {
  keyring: core.Keyring;

  private constructor(keyring: core.Keyring) {
    this.keyring = keyring;
  }

  static useKeyring(keyring: core.Keyring) {
    return new NativeAdapter(keyring);
  }

  async initialize(): Promise<number> {
    return 0;
  }

  async pairDevice(deviceId: string): Promise<core.HDWallet | null> {
    let wallet: core.HDWallet | null = this.keyring.get(deviceId);
    if (!wallet && deviceId) {
      // If a wallet with that ID hasn't been added to the keychain, then create it
      wallet = await native.create({ deviceId });
      if (!native.isNative(wallet)) throw new Error("expected native wallet");
      this.keyring.add(wallet, deviceId);
      this.keyring.decorateEvents(deviceId, wallet.events);
    }

    if (wallet && native.isNative(wallet)) {
      const id = await wallet.getDeviceID();
      this.keyring.emit([wallet.getVendor(), id, core.Events.CONNECT], id);

      return wallet;
    }

    return null;
  }
}
