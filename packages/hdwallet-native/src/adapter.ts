import * as core from "@shapeshiftoss/hdwallet-core";

import * as Isolation from "./crypto/isolation";
import * as native from "./native";

/**
 * NativeAdapter arguments
 *
 * Supports two initialization modes:
 * 1. From mnemonic: Wallet derives all master keys (secp256k1, ed25519, stark)
 * 2. From master keys: Externally-provided master keys for each curve type
 *
 * MASTER KEY TYPES:
 * - secp256k1MasterKey: For Bitcoin, Ethereum, Tron, Cosmos chains
 * - ed25519MasterKey: For Solana, Sui chains
 * - starkMasterKey: For Starknet (uses STARK curve, separate from secp256k1)
 *
 * Note: Starknet uses secp256k1 BIP32 derivation math but STARK curve for signing,
 * requiring a separate master key type. See engines/default/stark.ts for details.
 */
export type NativeAdapterArgs = {
  deviceId: string;
} & (
  | {
      mnemonic?: string | Isolation.Core.BIP39.Mnemonic;
      secp256k1MasterKey?: never;
      ed25519MasterKey?: never;
      starkMasterKey?: never;
    }
  | {
      mnemonic?: never;
      secp256k1MasterKey?: Isolation.Core.BIP32.Node;
      ed25519MasterKey?: Isolation.Core.Ed25519.Node;
      starkMasterKey?: Isolation.Core.Stark.Node;
    }
);

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

  async pairDevice(deviceId: string): Promise<native.NativeHDWallet | null> {
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
