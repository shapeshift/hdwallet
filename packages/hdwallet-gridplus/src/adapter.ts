/* eslint-disable no-console */
import * as core from "@shapeshiftoss/hdwallet-core";

import { GridPlusHDWallet } from "./gridplus";
import { GridPlusTransport } from "./transport";

export class GridPlusAdapter {
  keyring: core.Keyring;
  private activeTransports: Map<string, GridPlusTransport> = new Map();

  constructor(keyring: core.Keyring) {
    this.keyring = keyring;
  }

  public static useKeyring(keyring: core.Keyring) {
    return new GridPlusAdapter(keyring);
  }

  public async connectDevice(
    deviceId: string,
    password?: string,
    existingSessionId?: string
  ): Promise<{ transport: GridPlusTransport; isPaired: boolean; sessionId: string }> {
    const transport = (() => {
      const existing = this.activeTransports.get(deviceId);
      if (existing) return existing;

      const newTransport = new GridPlusTransport({
        deviceId,
        password: password || "shapeshift-default",
      });
      this.activeTransports.set(deviceId, newTransport);
      return newTransport;
    })();

    const { isPaired, sessionId } = await transport.setup(deviceId, password, existingSessionId);
    return { transport, isPaired, sessionId };
  }

  public async pairConnectedDevice(
    deviceId: string,
    pairingCode: string
  ): Promise<{
    wallet: GridPlusHDWallet;
    walletUid: string;
    isExternal: boolean;
  }> {
    const transport = this.activeTransports.get(deviceId);
    if (!transport) {
      throw new Error("Device not connected. Call connectDevice first.");
    }

    try {
      const pairingSuccess = await transport.pair(pairingCode);

      if (!pairingSuccess) {
        throw new Error("Pairing failed. Please check the 8-character code displayed on your Lattice device.");
      }

      const wallet = new GridPlusHDWallet(transport);
      wallet.setActiveWalletId(deviceId);
      await wallet.initialize();

      // Validate and capture wallet info after pairing and initialization
      console.log("[GridPlus Adapter] Device paired and initialized, validating active wallet...");

      const validation = await wallet.validateActiveWallet();
      console.log("[GridPlus Adapter] Pairing validation complete");
      console.log("[GridPlus Adapter] Wallet UID will be used as primary identifier:", validation.uid);
      console.log("[GridPlus Adapter] Wallet type:", validation.isExternal ? "SafeCard" : "Internal");

      this.keyring.add(wallet, deviceId);
      this.activeTransports.delete(deviceId);

      return {
        wallet,
        walletUid: validation.uid,
        isExternal: validation.isExternal,
      };
    } catch (error) {
      throw new Error(`GridPlus pairing failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  public async pairDevice(
    deviceId: string,
    password?: string,
    pairingCode?: string,
    existingSessionId?: string,
    expectedWalletUid?: string
  ): Promise<GridPlusHDWallet> {
    const existingWallet = this.keyring.get<GridPlusHDWallet>(deviceId);
    if (existingWallet) {
      // Reset Client activeWallets state and fetch fresh UIDs from currently inserted SafeCard
      await existingWallet.transport.setup(deviceId, password, existingSessionId);
      // Ensure the wallet has the correct active walletId set
      existingWallet.setActiveWalletId(deviceId);
      // Reinitialize to clear cached addresses when reconnecting (e.g., SafeCard swap)
      await existingWallet.initialize();

      // Validate wallet UID if expected
      if (expectedWalletUid) {
        console.log("[GridPlus Adapter] Validating reconnection, expecting UID:", expectedWalletUid);
        const validation = await existingWallet.validateActiveWallet(expectedWalletUid);
        if (!validation.isValid) {
          const errorMsg = `Wallet UID mismatch! Expected ${expectedWalletUid.slice(
            -8
          )}, but found ${validation.uid.slice(-8)}. Please insert the correct SafeCard.`;
          console.error("[GridPlus Adapter] " + errorMsg);
          throw new Error(errorMsg);
        }
        console.log("[GridPlus Adapter] Wallet validation successful, UID matches");
      }

      return existingWallet;
    }

    const { isPaired } = await this.connectDevice(deviceId, password, existingSessionId);

    if (!isPaired) {
      if (pairingCode) {
        const { wallet } = await this.pairConnectedDevice(deviceId, pairingCode);
        return wallet;
      } else {
        throw new Error("PAIRING_REQUIRED");
      }
    }

    // Already paired - create wallet directly
    const transport = this.activeTransports.get(deviceId)!;
    const wallet = new GridPlusHDWallet(transport);
    wallet.setActiveWalletId(deviceId);
    await wallet.initialize();

    // Validate wallet UID if expected (even for new wallet creation)
    if (expectedWalletUid) {
      console.log("[GridPlus Adapter] Validating new wallet connection, expecting UID:", expectedWalletUid);
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

    this.keyring.add(wallet, deviceId);
    this.activeTransports.delete(deviceId);
    return wallet;
  }

  public async initialize(deviceId: string, password?: string): Promise<number> {
    await this.pairDevice(deviceId, password);
    return Object.keys(this.keyring.wallets).length;
  }

  public get(deviceId: string): GridPlusHDWallet {
    return core.mustBeDefined(this.keyring.get<GridPlusHDWallet>(deviceId));
  }
}
