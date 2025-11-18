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
    const transport =
      this.activeTransports.get(deviceId) ??
      new GridPlusTransport({
        deviceId,
        password: password || "shapeshift-default",
      });

    this.activeTransports.set(deviceId, transport);

    const { isPaired, sessionId } = await transport.setup(deviceId, password, existingSessionId);
    return { transport, isPaired, sessionId };
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

      const wallet = new GridPlusHDWallet(transport);
      wallet.setActiveWalletId(deviceId);
      await wallet.initialize();
      this.keyring.add(wallet, deviceId);
      this.activeTransports.delete(deviceId);

      return wallet;
    } catch (error) {
      throw new Error(`GridPlus pairing failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  public async pairDevice(
    deviceId: string,
    password?: string,
    pairingCode?: string,
    existingSessionId?: string
  ): Promise<GridPlusHDWallet> {
    const existingWallet = this.keyring.get<GridPlusHDWallet>(deviceId);
    console.log({ existingWallet });
    if (existingWallet) {
      // Reset Client activeWallets state and fetch fresh UIDs from currently inserted SafeCard
      await existingWallet.transport.setup(deviceId, password, existingSessionId);
      // Ensure the wallet has the correct active walletId set
      existingWallet.setActiveWalletId(deviceId);
      // Reinitialize to clear cached addresses when reconnecting (e.g., SafeCard swap)
      await existingWallet.initialize();
      return existingWallet;
    }

    const { isPaired, transport } = await this.connectDevice(deviceId, password, existingSessionId);

    console.log({ isPaired, transport });

    if (!isPaired) {
      if (pairingCode) {
        return await this.pairConnectedDevice(deviceId, pairingCode);
      } else {
        // EMIT PAIRING CODE EVENT
        const wallet = new GridPlusHDWallet(transport);
        wallet.setActiveWalletId(deviceId);
        this.keyring.add(wallet, deviceId);
        this.activeTransports.delete(deviceId);
        return wallet;
      }
    }

    // Already paired - create wallet directly
    const transport1 = this.activeTransports.get(deviceId)!;
    const wallet = new GridPlusHDWallet(transport1);
    wallet.setActiveWalletId(deviceId);
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
