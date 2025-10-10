import * as core from "@shapeshiftoss/hdwallet-core";
import { Client, setup, getClient, pair as sdkPair } from "gridplus-sdk";
import { randomBytes } from "crypto";

export interface GridPlusTransportConfig {
  deviceId?: string;
  password?: string;
  name?: string;
}

export class GridPlusTransport extends core.Transport {
  public deviceId?: string;
  public password?: string;
  public name?: string;
  public connected: boolean = false;
  private client?: Client;
  // Session identifier used to track reconnections. When present, we can skip
  // passing deviceId to SDK setup() which avoids triggering the pairing screen
  // on the device and enables faster reconnection from localStorage.
  private sessionId?: string;

  constructor(config: GridPlusTransportConfig = {}) {
    super(new core.Keyring());
    this.deviceId = config.deviceId;
    this.password = config.password;
    this.name = config.name || "ShapeShift";
  }

  public getDeviceID(): Promise<string> {
    return Promise.resolve(this.deviceId || "");
  }

  public async connect(): Promise<void> {
    if (!this.deviceId) {
      throw new Error("Device ID is required to connect to GridPlus");
    }

    const { isPaired } = await this.setup(this.deviceId, this.password);

    // For HDWallet interface compliance, connect() should not return a value
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

  public async setup(deviceId: string, password?: string, existingSessionId?: string): Promise<{ isPaired: boolean; sessionId: string }> {
    this.deviceId = deviceId;
    this.password = password || "shapeshift-default";

    // Use existing sessionId if provided, otherwise generate new one
    if (existingSessionId) {
      this.sessionId = existingSessionId;
    } else if (!this.sessionId) {
      this.sessionId = randomBytes(32).toString('hex');
    }

    // Initialize SDK and get client instance
    if (!this.client) {
      // Check if we have stored client data for reconnection optimization
      const storedClient = localStorage.getItem('gridplus-client');
      const hasStoredClient = !!storedClient;

      // Call SDK setup() which creates client and connects to device
      // Returns boolean indicating if device is paired
      try {
        let isPaired: boolean;

        // Optimize reconnection: if we have both stored client and existingSessionId,
        // call setup() WITHOUT deviceId/password/name so SDK loads from localStorage.
        // This avoids unnecessary device communication and prevents triggering pairing screen.
        if (hasStoredClient && existingSessionId) {
          isPaired = await setup({
            getStoredClient: async () => {
              return localStorage.getItem('gridplus-client') || '';
            },
            setStoredClient: async (client) => {
              if (client) localStorage.setItem('gridplus-client', client);
            },
          });
        } else {
          isPaired = await setup({
            name: this.name || "ShapeShift",
            deviceId,
            password: this.password,
            getStoredClient: async () => {
              return localStorage.getItem('gridplus-client') || '';
            },
            setStoredClient: async (client) => {
              if (client) localStorage.setItem('gridplus-client', client);
            },
          });
        }

        // Get the SDK's client instance (don't create our own!)
        this.client = await getClient();

        if (!this.client) {
          throw new Error('Failed to get client from SDK after setup()');
        }

        this.connected = true;

        return { isPaired, sessionId: this.sessionId };
      } catch (error) {
        // Handle "Device Locked" error - treat as unpaired
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.toLowerCase().includes('device locked')) {
          // Even though connect failed, we can still get the client for pairing
          this.client = await getClient();

          if (!this.client) {
            throw new Error('Failed to get client after device locked error');
          }

          this.connected = true;
          return { isPaired: false, sessionId: this.sessionId };
        }

        throw error;
      }
    } else {
      this.connected = true;
      // Client already exists, assume paired
      return { isPaired: true, sessionId: this.sessionId };
    }
  }

  // Setup transport for reconnection using stored client state
  // SDK's getStoredClient will return existing client state, avoiding new pairing
  public async setupWithoutConnect(deviceId: string, password?: string, existingSessionId?: string): Promise<void> {
    this.deviceId = deviceId;
    this.password = password || "shapeshift-default";
    this.sessionId = existingSessionId!;

    // SDK will load existing client state from localStorage via getStoredClient
    // No need to call connect() again - stored state preserves pairing
    if (!this.client) {
      const storedClient = localStorage.getItem('gridplus-client');

      if (storedClient) {
        // Optimized reconnection: load from localStorage without device communication
        // Calling setup() WITHOUT deviceId/password/name avoids triggering pairing screen
        await setup({
          getStoredClient: async () => storedClient,
          setStoredClient: async (client) => {
            if (client) localStorage.setItem('gridplus-client', client);
          },
        });
      } else {
        // Fallback: no stored client, need device communication
        await setup({
          name: this.name || "ShapeShift",
          deviceId,
          password: this.password,
          getStoredClient: async () => '',
          setStoredClient: async (client) => {
            if (client) localStorage.setItem('gridplus-client', client);
          },
        });
      }

      this.client = await getClient();

      if (!this.client) {
        throw new Error('Failed to get client in setupWithoutConnect');
      }
    }

    this.connected = true;
  }

  public async pair(pairingCode: string): Promise<boolean> {
    if (!this.client) {
      throw new Error("Client not initialized. Call setup() first.");
    }

    // Use SDK's pair() wrapper function which handles the client properly
    try {
      const result = await sdkPair(pairingCode);
      this.connected = !!result;
      return !!result;
    } catch (error) {
      throw error;
    }
  }

  public getClient(): Client | undefined {
    return this.client;
  }

  public getSessionId(): string | undefined {
    return this.sessionId;
  }

  public async call(...args: any[]): Promise<any> {
    throw new Error("GridPlus transport call not implemented");
  }
}