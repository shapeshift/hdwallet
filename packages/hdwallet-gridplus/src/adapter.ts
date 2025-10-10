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

  public async connectDevice(deviceId: string, password?: string, existingSessionId?: string): Promise<{ transport: GridPlusTransport, isPaired: boolean, sessionId: string }> {
    // Get or create transport for this device
    let transport = this.activeTransports.get(deviceId);
    if (!transport) {
      transport = new GridPlusTransport({
        deviceId,
        password: password || "shapeshift-default",
        name: "ShapeShift"
      });
      this.activeTransports.set(deviceId, transport);
    }

    // Attempt connection with optional existing sessionId
    try {
      const { isPaired, sessionId } = await transport.setup(deviceId, password, existingSessionId);
      return { transport, isPaired, sessionId };
    } catch (error) {
      throw error;
    }
  }

  public async pairConnectedDevice(deviceId: string, pairingCode: string): Promise<GridPlusHDWallet> {
    const transport = this.activeTransports.get(deviceId);
    if (!transport) {
      throw new Error("Device not connected. Call connectDevice first.");
    }

    try {
      const pairingSuccess = await transport.pair(pairingCode);

      if (!pairingSuccess) {
        throw new Error("Pairing failed. Please check the 8-character code displayed on your Lattice device.");
      }

      // Create the wallet
      const wallet = new GridPlusHDWallet(transport);

      await wallet.initialize();

      // Add to keyring
      this.keyring.add(wallet, deviceId);

      // Clean up transport from active list since pairing is complete
      this.activeTransports.delete(deviceId);

      return wallet;
    } catch (error) {
      throw new Error(`GridPlus pairing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Legacy method for backward compatibility - but now using two-step approach
  public async pairDevice(deviceId: string, password?: string, pairingCode?: string, existingSessionId?: string): Promise<GridPlusHDWallet> {
    // If we have an existing sessionId, skip connectDevice() and use setupWithoutConnect().
    // This avoids triggering the pairing screen on device for reconnections by loading
    // directly from localStorage without passing deviceId to GridPlus SDK's setup().
    if (existingSessionId) {
      const existingWallet = this.keyring.get<GridPlusHDWallet>(deviceId);
      if (existingWallet) {
        return existingWallet;
      }

      let transport = this.activeTransports.get(deviceId);
      if (!transport) {
        transport = new GridPlusTransport({
          deviceId,
          password: password || "shapeshift-default",
          name: "ShapeShift"
        });
        this.activeTransports.set(deviceId, transport);

        await transport.setupWithoutConnect(deviceId, password, existingSessionId);
      }

      const wallet = new GridPlusHDWallet(transport);
      await wallet.initialize();
      this.keyring.add(wallet, deviceId);
      this.activeTransports.delete(deviceId);
      return wallet;
    }

    // Original flow for new connections
    const { isPaired } = await this.connectDevice(deviceId, password, existingSessionId);

    if (!isPaired) {
      if (pairingCode) {
        return await this.pairConnectedDevice(deviceId, pairingCode);
      } else {
        throw new Error("PAIRING_REQUIRED");
      }
    }

    // Already paired - create wallet directly
    const transport = this.activeTransports.get(deviceId)!;
    const wallet = new GridPlusHDWallet(transport);
    await wallet.initialize();
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