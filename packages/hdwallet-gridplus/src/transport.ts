import * as core from "@shapeshiftoss/hdwallet-core";
import { randomBytes } from "crypto";
import { Client } from "gridplus-sdk";

export type GridPlusTransportConfig = {
  deviceId: string;
  password?: string;
};

export class GridPlusTransport extends core.Transport {
  public deviceId?: string;
  public password?: string;
  public connected: boolean = false;
  private client?: Client;
  // Session identifier used to track reconnections. When present, we can skip
  // passing deviceId to SDK setup() which avoids triggering the pairing screen
  // on the device and enables faster reconnection from localStorage.
  private sessionId?: string;

  constructor(config: GridPlusTransportConfig) {
    super(new core.Keyring());
    this.deviceId = config.deviceId;
    this.password = config.password;
  }

  public getDeviceID(): Promise<string> {
    return Promise.resolve(this.deviceId || "");
  }

  public async connect(): Promise<void> {
    if (!this.deviceId) {
      throw new Error("Device ID is required to connect to GridPlus");
    }

    const { isPaired } = await this.setup(this.deviceId, this.password);

    if (!isPaired) {
      throw new Error("Device is not paired");
    }
  }

  public async connectGridPlus(deviceId: string, password?: string): Promise<void> {
    this.deviceId = deviceId;
    this.password = password || "shapeshift-default";
    await this.connect();
  }

  public async disconnect(): Promise<void> {
    this.connected = false;
    this.deviceId = undefined;
    this.password = undefined;
  }

  public isConnected(): boolean {
    return this.connected;
  }

  public async setup(
    deviceId: string,
    password?: string,
    existingSessionId?: string
  ): Promise<{ isPaired: boolean; sessionId: string }> {
    this.deviceId = deviceId;
    this.password = password || "shapeshift-default";

    // Use existing sessionId if provided, otherwise generate new one
    if (existingSessionId) {
      this.sessionId = existingSessionId;
    } else if (!this.sessionId) {
      this.sessionId = randomBytes(32).toString("hex");
    }

    // Create Client instance directly (Frame pattern) - no localStorage!
    // This ensures we always get fresh activeWallets from device
    if (!this.client) {
      this.client = new Client({
        name: "ShapeShift",
        baseUrl: "https://signing.gridpl.us",
        privKey: Buffer.from(this.sessionId, "hex"),
        retryCount: 3,
        timeout: 60000,
        skipRetryOnWrongWallet: true,
      });

      try {
        // Connect to device - returns true if paired, false if needs pairing
        const isPaired = await this.client.connect(deviceId);
        this.connected = true;
        return { isPaired, sessionId: this.sessionId };
      } catch (error) {
        // Handle "Device Locked" error - treat as unpaired
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.toLowerCase().includes("device locked")) {
          this.connected = true;
          return { isPaired: false, sessionId: this.sessionId };
        }

        throw error;
      }
    } else {
      // Client already exists, reset active wallets to clear stale state before reconnecting
      // This is critical when switching between SafeCards - ensures fresh wallet state from device
      this.client.resetActiveWallets();
      const isPaired = await this.client.connect(deviceId);
      this.connected = true;
      return { isPaired, sessionId: this.sessionId };
    }
  }

  public async pair(pairingCode: string): Promise<boolean> {
    if (!this.client) {
      throw new Error("Client not initialized. Call setup() first.");
    }

    const result = await this.client.pair(pairingCode);
    this.connected = !!result;
    return !!result;
  }

  public getClient(): Client | undefined {
    return this.client;
  }

  public getSessionId(): string | undefined {
    return this.sessionId;
  }

  public async call(): Promise<any> {
    throw new Error("GridPlus transport call not implemented");
  }
}
