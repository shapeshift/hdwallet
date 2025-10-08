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


  // Frame-style: First establish connection and check pairing status
  public async connectDevice(deviceId: string, password?: string, existingPrivKey?: string): Promise<{ transport: GridPlusTransport, isPaired: boolean, privKey: string }> {
    console.log('[GridPlus Adapter] connectDevice() called', {
      deviceId,
      hasExistingPrivKey: !!existingPrivKey,
      existingPrivKey: existingPrivKey ? `${existingPrivKey.slice(0, 8)}...` : null,
      activeTransportsSize: this.activeTransports.size,
    });

    // Get or create transport for this device
    let transport = this.activeTransports.get(deviceId);
    if (!transport) {
      console.log('[GridPlus Adapter] Creating new transport for device');
      transport = new GridPlusTransport({
        deviceId,
        password: password || "shapeshift-default",
        name: "ShapeShift"
      });
      this.activeTransports.set(deviceId, transport);
    } else {
      console.log('[GridPlus Adapter] Reusing existing transport for device');
    }

    // Attempt connection with optional existing privKey
    console.log('[GridPlus Adapter] Calling transport.setup()...');
    try {
      const { isPaired, privKey } = await transport.setup(deviceId, password, existingPrivKey);
      console.log('[GridPlus Adapter] transport.setup() completed:', {
        isPaired,
        privKey: `${privKey.slice(0, 8)}...`,
      });
      return { transport, isPaired, privKey };
    } catch (error) {
      console.error('[GridPlus Adapter] transport.setup() error:', {
        error,
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  // Frame-style: Pair an already connected device
  public async pairConnectedDevice(deviceId: string, pairingCode: string): Promise<GridPlusHDWallet> {
    console.log('[GridPlus Adapter] pairConnectedDevice() called', {
      deviceId,
      pairingCode,
      activeTransportsSize: this.activeTransports.size,
      hasTransport: this.activeTransports.has(deviceId),
    });

    const transport = this.activeTransports.get(deviceId);
    if (!transport) {
      console.error('[GridPlus Adapter] No transport found for device');
      throw new Error("Device not connected. Call connectDevice first.");
    }

    console.log('[GridPlus Adapter] Transport found, calling transport.pair()...');
    try {
      const pairingSuccess = await transport.pair(pairingCode);
      console.log('[GridPlus Adapter] transport.pair() completed:', { pairingSuccess });

      if (!pairingSuccess) {
        console.error('[GridPlus Adapter] Pairing returned false');
        throw new Error("Pairing failed. Please check the 8-character code displayed on your Lattice device.");
      }

      // Create the wallet
      console.log('[GridPlus Adapter] Creating GridPlusHDWallet...');
      const wallet = new GridPlusHDWallet(transport);

      console.log('[GridPlus Adapter] Initializing wallet...');
      await wallet.initialize();
      console.log('[GridPlus Adapter] Wallet initialized');

      // Add to keyring
      console.log('[GridPlus Adapter] Adding wallet to keyring');
      this.keyring.add(wallet, deviceId);

      // Clean up transport from active list since pairing is complete
      console.log('[GridPlus Adapter] Removing transport from active list');
      this.activeTransports.delete(deviceId);

      console.log('[GridPlus Adapter] pairConnectedDevice() SUCCESS');
      return wallet;
    } catch (error) {
      console.error('[GridPlus Adapter] pairConnectedDevice() error:', {
        error,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw new Error(`GridPlus pairing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Legacy method for backward compatibility - but now using two-step approach
  public async pairDevice(deviceId: string, password?: string, pairingCode?: string, existingPrivKey?: string): Promise<GridPlusHDWallet> {
    console.log('[GridPlus Adapter] pairDevice() called', {
      deviceId,
      hasPairingCode: !!pairingCode,
      hasExistingPrivKey: !!existingPrivKey,
      existingPrivKey: existingPrivKey ? `${existingPrivKey.slice(0, 8)}...` : null,
    });

    // If we have an existing privKey, skip connectDevice() and use setupWithoutConnect()
    // This avoids triggering the pairing screen on device for reconnections
    if (existingPrivKey) {
      console.log('[GridPlus Adapter] pairDevice: Using reconnect flow with existing privKey');

      const existingWallet = this.keyring.get<GridPlusHDWallet>(deviceId);
      if (existingWallet) {
        console.log('[GridPlus Adapter] pairDevice: Returning existing wallet from keyring');
        return existingWallet;
      }

      let transport = this.activeTransports.get(deviceId);
      if (!transport) {
        console.log('[GridPlus Adapter] pairDevice: Creating new transport for reconnect');
        transport = new GridPlusTransport({
          deviceId,
          password: password || "shapeshift-default",
          name: "ShapeShift"
        });
        this.activeTransports.set(deviceId, transport);

        await transport.setupWithoutConnect(deviceId, password, existingPrivKey);
      } else {
        console.log('[GridPlus Adapter] pairDevice: Reusing existing transport for reconnect');
      }

      console.log('[GridPlus Adapter] pairDevice: Creating wallet for reconnect');
      const wallet = new GridPlusHDWallet(transport);
      await wallet.initialize();
      this.keyring.add(wallet, deviceId);
      this.activeTransports.delete(deviceId);
      console.log('[GridPlus Adapter] pairDevice: Reconnect SUCCESS');
      return wallet;
    }

    // Original flow for new connections
    console.log('[GridPlus Adapter] pairDevice: Using fresh pairing flow');
    const { isPaired } = await this.connectDevice(deviceId, password, existingPrivKey);

    if (!isPaired) {
      console.log('[GridPlus Adapter] pairDevice: Device not paired');
      if (pairingCode) {
        console.log('[GridPlus Adapter] pairDevice: Has pairing code, calling pairConnectedDevice');
        return await this.pairConnectedDevice(deviceId, pairingCode);
      } else {
        console.log('[GridPlus Adapter] pairDevice: No pairing code, throwing PAIRING_REQUIRED');
        throw new Error("PAIRING_REQUIRED");
      }
    }

    // Already paired - create wallet directly
    console.log('[GridPlus Adapter] pairDevice: Device already paired, creating wallet');
    const transport = this.activeTransports.get(deviceId)!;
    const wallet = new GridPlusHDWallet(transport);
    await wallet.initialize();
    this.keyring.add(wallet, deviceId);
    this.activeTransports.delete(deviceId);
    console.log('[GridPlus Adapter] pairDevice: Already-paired flow SUCCESS');
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