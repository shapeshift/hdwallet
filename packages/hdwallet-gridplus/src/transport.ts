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
  private privKey?: string;

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

  public async setup(deviceId: string, password?: string, existingPrivKey?: string): Promise<{ isPaired: boolean; privKey: string }> {
    console.log('[GridPlus Transport] setup() called', {
      deviceId,
      hasExistingPrivKey: !!existingPrivKey,
      existingPrivKey: existingPrivKey ? `${existingPrivKey.slice(0, 8)}...` : null,
      hasClient: !!this.client,
    });

    this.deviceId = deviceId;
    this.password = password || "shapeshift-default";

    // Use existing privKey if provided, otherwise generate new one
    if (existingPrivKey) {
      this.privKey = existingPrivKey;
      console.log('[GridPlus Transport] Using existing privKey');
    } else if (!this.privKey) {
      this.privKey = randomBytes(32).toString('hex');
      console.log('[GridPlus Transport] Generated new privKey:', `${this.privKey.slice(0, 8)}...`);
    } else {
      console.log('[GridPlus Transport] Reusing transport privKey:', `${this.privKey.slice(0, 8)}...`);
    }

    // Initialize SDK and get client instance
    if (!this.client) {
      console.log('[GridPlus Transport] Calling SDK setup()...');

      // Check if we have stored client data for reconnection optimization
      const storedClient = localStorage.getItem('gridplus-client');
      const hasStoredClient = !!storedClient;

      console.log('[GridPlus Transport] Reconnection check:', {
        hasStoredClient,
        hasExistingPrivKey: !!existingPrivKey,
        willOptimizeReconnection: hasStoredClient && !!existingPrivKey,
      });

      // Call SDK setup() which creates client and connects to device
      // Returns boolean indicating if device is paired
      try {
        let isPaired: boolean;

        // Optimize reconnection: if we have both stored client and existingPrivKey,
        // call setup() WITHOUT deviceId/password/name so SDK loads from localStorage
        // This avoids unnecessary device communication
        if (hasStoredClient && existingPrivKey) {
          console.log('[GridPlus Transport] Using optimized reconnection (loading from localStorage)');
          isPaired = await setup({
            getStoredClient: async () => {
              return localStorage.getItem('gridplus-client') || '';
            },
            setStoredClient: async (client) => {
              if (client) localStorage.setItem('gridplus-client', client);
            },
          });
        } else {
          console.log('[GridPlus Transport] Using standard connection (creating new client)');
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

        console.log('[GridPlus Transport] SDK setup() completed:', { isPaired });

        // Get the SDK's client instance (don't create our own!)
        this.client = await getClient();

        if (!this.client) {
          throw new Error('Failed to get client from SDK after setup()');
        }

        console.log('[GridPlus Transport] Retrieved SDK client instance');
        this.connected = true;

        return { isPaired, privKey: this.privKey };
      } catch (error) {
        console.error('[GridPlus Transport] SDK setup() error:', {
          error,
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });

        // Handle "Device Locked" error - treat as unpaired
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.toLowerCase().includes('device locked')) {
          console.log('[GridPlus Transport] Device locked - getting client anyway');

          // Even though connect failed, we can still get the client for pairing
          this.client = await getClient();

          if (!this.client) {
            throw new Error('Failed to get client after device locked error');
          }

          this.connected = true;
          return { isPaired: false, privKey: this.privKey };
        }

        throw error;
      }
    } else {
      console.log('[GridPlus Transport] Reusing existing Client');
      this.connected = true;
      // Client already exists, assume paired
      return { isPaired: true, privKey: this.privKey };
    }
  }

  // Setup transport for reconnection using stored client state
  // SDK's getStoredClient will return existing client state, avoiding new pairing
  public async setupWithoutConnect(deviceId: string, password?: string, existingPrivKey?: string): Promise<void> {
    console.log('[GridPlus Transport] setupWithoutConnect() called');
    this.deviceId = deviceId;
    this.password = password || "shapeshift-default";
    this.privKey = existingPrivKey!;

    // SDK will load existing client state from localStorage via getStoredClient
    // No need to call connect() again - stored state preserves pairing
    if (!this.client) {
      await setup({
        name: this.name || "ShapeShift",
        deviceId,
        password: this.password,
        getStoredClient: async () => localStorage.getItem('gridplus-client') || '',
        setStoredClient: async (client) => {
          if (client) localStorage.setItem('gridplus-client', client);
        },
      });

      this.client = await getClient();

      if (!this.client) {
        throw new Error('Failed to get client in setupWithoutConnect');
      }

      console.log('[GridPlus Transport] Retrieved SDK client for reconnect');
    }

    this.connected = true;
  }

  public async pair(pairingCode: string): Promise<boolean> {
    console.log('[GridPlus Transport] pair() called', {
      pairingCode,
      hasClient: !!this.client,
      connected: this.connected,
      deviceId: this.deviceId,
    });

    if (!this.client) {
      console.error('[GridPlus Transport] Client not initialized');
      throw new Error("Client not initialized. Call setup() first.");
    }

    // Use SDK's pair() wrapper function which handles the client properly
    try {
      console.log('[GridPlus Transport] Calling SDK pair() wrapper...');
      const result = await sdkPair(pairingCode);
      console.log('[GridPlus Transport] SDK pair() result:', result);
      this.connected = !!result;
      return !!result;
    } catch (error) {
      console.error('[GridPlus Transport] SDK pair() error:', {
        error,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  public getClient(): Client | undefined {
    return this.client;
  }

  public getPrivKey(): string | undefined {
    return this.privKey;
  }

  public async call(...args: any[]): Promise<any> {
    throw new Error("GridPlus transport call not implemented");
  }
}