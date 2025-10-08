import * as core from "@shapeshiftoss/hdwallet-core";
import { Client, setup } from "gridplus-sdk";
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

    // Create Client with localStorage state management
    if (!this.client) {
      console.log('[GridPlus Transport] Creating new Client...');

      // Initialize SDK global state using setup()
      // This sets up loadClient/saveClient for wrapper functions like fetchSolanaAddresses
      try {
        const storedClient = localStorage.getItem('gridplus-client') || '';
        console.log('[GridPlus Transport] localStorage gridplus-client:', storedClient ? `${storedClient.slice(0, 50)}...` : 'empty');

        await setup({
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
        console.log('[GridPlus Transport] SDK setup() completed');
      } catch (e) {
        console.error('[GridPlus Transport] SDK setup() failed:', e);
        throw e;
      }

      // Create the Client with same config
      this.client = new Client({
        name: this.name || "ShapeShift",
        baseUrl: 'https://signing.gridpl.us',
        privKey: this.privKey,
        deviceId,
        setStoredClient: async (client: string | null) => {
          try {
            if (client) localStorage.setItem('gridplus-client', client);
          } catch (e) {
            // Ignore localStorage errors
          }
        }
      });
      console.log('[GridPlus Transport] Client instance created');
    } else {
      console.log('[GridPlus Transport] Reusing existing Client');
    }

    // Connect to device (Frame-style)
    try {
      console.log('[GridPlus Transport] Calling client.connect()...');
      const isPaired = await this.client.connect(deviceId);
      console.log('[GridPlus Transport] client.connect() completed:', { isPaired });
      this.connected = true; // We're connected to the client, regardless of pairing status
      return { isPaired, privKey: this.privKey };
    } catch (error) {
      console.error('[GridPlus Transport] client.connect() error:', {
        error,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      // Frame approach: If it's just a "Device Locked" error during initial connect,
      // don't throw - treat it as "unpaired" state
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.toLowerCase().includes('device locked')) {
        console.log('[GridPlus Transport] Device locked - treating as unpaired');
        this.connected = true; // We are connected to client, just not paired
        return { isPaired: false, privKey: this.privKey }; // Return false for unpaired, don't throw
      }

      // For other errors, still throw
      console.error('[GridPlus Transport] Rethrowing error');
      throw error;
    }
  }

  // Setup transport for reconnection without calling client.connect()
  // This avoids triggering device pairing screen when already paired
  public async setupWithoutConnect(deviceId: string, password?: string, existingPrivKey?: string): Promise<void> {
    this.deviceId = deviceId;
    this.password = password || "shapeshift-default";
    this.privKey = existingPrivKey!;

    // Create Client without calling connect()
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

      this.client = new Client({
        name: this.name || "ShapeShift",
        baseUrl: 'https://signing.gridpl.us',
        privKey: this.privKey,
        deviceId,
        setStoredClient: async (client: string | null) => {
          try {
            if (client) localStorage.setItem('gridplus-client', client);
          } catch (e) {
            // Ignore localStorage errors
          }
        }
      });
    }

    this.connected = true; // We're already paired, skip connect()
  }

  public async pair(pairingCode: string): Promise<boolean> {
    console.log('[GridPlus Transport] pair() called', {
      pairingCode,
      hasClient: !!this.client,
      connected: this.connected,
    });

    if (!this.client) {
      console.error('[GridPlus Transport] Client not initialized');
      throw new Error("Client not initialized. Call setup() first.");
    }

    try {
      console.log('[GridPlus Transport] Calling client.pair()...');
      const result = await this.client.pair(pairingCode);
      console.log('[GridPlus Transport] client.pair() result:', result);
      this.connected = !!result;
      return !!result;
    } catch (error) {
      console.error('[GridPlus Transport] client.pair() error:', {
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