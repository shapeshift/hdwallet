/* eslint-disable no-console */
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

    // Validate wallet UID if expected (reconnection scenario)
    if (expectedWalletUid) {
      console.log("[GridPlus Adapter] Validating reconnection, expecting UID:", expectedWalletUid);
      const validation = await wallet.validateActiveWallet(expectedWalletUid);
      if (!validation.isValid) {
        const errorMsg = `Wallet UID mismatch! Expected ${expectedWalletUid.slice(
          -8
        )}, but found ${validation.uid.slice(-8)}. Please insert the correct SafeCard.`;
        console.error("[GridPlus Adapter] " + errorMsg);
        throw new Error(errorMsg);
      }
      console.log("[GridPlus Adapter] Wallet validation successful, UID matches");
    }

    return wallet;
  }

  public async pairDevice(pairingCode: string): Promise<{
    wallet: GridPlusHDWallet;
    walletUid: string;
    isExternal: boolean;
  }> {
    if (!this.client) throw new Error("No client connected. Call connectDevice first.");

    const success = await this.client.pair(pairingCode);
    if (!success) throw new Error("Failed to pair.");

    const wallet = new GridPlusHDWallet(this.client);
    this.keyring.add(wallet, this.client.getDeviceId());

    // Validate and capture wallet info after pairing
    console.log("[GridPlus Adapter] Device paired, validating active wallet...");
    const validation = await wallet.validateActiveWallet();
    console.log("[GridPlus Adapter] Pairing validation complete");
    console.log("[GridPlus Adapter] Wallet UID will be used as primary identifier:", validation.uid);
    console.log("[GridPlus Adapter] Wallet type:", validation.isExternal ? "SafeCard" : "Internal");

    return {
      wallet,
      walletUid: validation.uid,
      isExternal: validation.isExternal,
    };
  }
}
