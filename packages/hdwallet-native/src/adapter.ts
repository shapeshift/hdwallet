import * as core from "@shapeshiftoss/hdwallet-core";

import * as native from "./native";
import * as Isolation from "./crypto/isolation";

export type NativeAdapterArgs = {
  mnemonic?: string | Isolation.Core.BIP39.Mnemonic;
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
    const oldWallet: core.HDWallet | undefined = this.keyring.get(deviceId);
    if (oldWallet && oldWallet instanceof native.NativeHDWallet) return oldWallet;

    if (!oldWallet && deviceId) {
      // If a wallet with that ID hasn't been added to the keychain, then create it
      const newWallet = await native.create({ deviceId });
      await this.keyring.add(newWallet, deviceId);
      return newWallet;
    }

    return null;
  }
}
