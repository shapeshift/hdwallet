import * as core from "@shapeshiftoss/hdwallet-core";
import { createHash } from "crypto";
import { Client } from "gridplus-sdk";

import { GridPlusHDWallet } from "./gridplus";

const name = "ShapeShift";
const baseUrl = "https://signing.gridpl.us";

export class GridPlusAdapter {
  keyring: core.Keyring;

  private client?: Client;

  constructor(keyring: core.Keyring) {
    this.keyring = keyring;
  }

  public static useKeyring(keyring: core.Keyring) {
    return new GridPlusAdapter(keyring);
  }

  public async connectDevice(
    deviceId: string,
    password = "",
    expectedWalletUid?: string
  ): Promise<GridPlusHDWallet | undefined> {
    const privKey = createHash("sha256")
      .update(deviceId + password + name)
      .digest();

    if (!this.client) {
      this.client = new Client({ name, baseUrl, privKey, deviceId });
    } else {
      // Client already exists, reset active wallets to clear stale state before reconnecting
      // This is critical when switching between SafeCards - ensures fresh wallet state from device
      this.client.resetActiveWallets();
    }

    const isPaired = await this.client.connect(deviceId);
    if (!isPaired) return undefined;

    const wallet = new GridPlusHDWallet(this.client);

    if (expectedWalletUid) {
      await wallet.validateActiveWallet(expectedWalletUid);
    }

    return wallet;
  }

  public async pairDevice(pairingCode: string): Promise<{
    wallet: GridPlusHDWallet;
    walletUid: string;
    type: 'external' | 'internal';
  }> {
    if (!this.client) throw new Error("No client connected. Call connectDevice first.");

    const success = await this.client.pair(pairingCode);
    if (!success) throw new Error("Failed to pair.");

    const wallet = new GridPlusHDWallet(this.client);
    this.keyring.add(wallet, this.client.getDeviceId());

    // Use cached active wallet data (SDK already fetched it during pair())
    const activeWallet = this.client.getActiveWallet();
    if (!activeWallet) throw new Error("No active wallet found on device");

    const uid = activeWallet.uid.toString("hex");
    const type: 'external' | 'internal' = activeWallet.external ? 'external' : 'internal';

    return {
      wallet,
      walletUid: uid,
      type,
    };
  }
}
