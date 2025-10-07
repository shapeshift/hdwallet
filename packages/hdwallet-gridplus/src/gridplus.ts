import Common from "@ethereumjs/common";
import { FeeMarketEIP1559Transaction, Transaction } from "@ethereumjs/tx";
import { SignTypedDataVersion, TypedDataUtils } from "@metamask/eth-sig-util";
import * as core from "@shapeshiftoss/hdwallet-core";
import { Client, Constants, Utils } from "gridplus-sdk";
import isObject from "lodash/isObject";
import { encode } from "rlp";

import { GridPlusTransport } from "./transport";

export function isGridPlus(wallet: core.HDWallet): wallet is GridPlusHDWallet {
  return isObject(wallet) && (wallet as any)._isGridPlus;
}

export class GridPlusHDWallet implements core.HDWallet, core.ETHWallet, core.SolanaWallet {
  readonly _isGridPlus = true;
  private addressCache = new Map<string, core.Address>();
  private callCounter = 0;
  private instanceId = Math.random().toString(36).substr(2, 9);
  private pendingRequests = new Map<string, Promise<core.Address | null>>();

  // ETH support flags (following KeepKey pattern)
  readonly _supportsETH = true;
  readonly _supportsETHInfo = true;
  readonly _supportsEthSwitchChain = false;
  readonly _supportsAvalanche = true;
  readonly _supportsOptimism = true;
  readonly _supportsPolygon = true;
  readonly _supportsGnosis = true;
  readonly _supportsArbitrum = true;
  readonly _supportsArbitrumNova = false;
  readonly _supportsBase = true;
  readonly _supportsBSC = true;
  readonly _supportsSolana = false;
  readonly _supportsSolanaInfo = false;

  info: GridPlusWalletInfo & core.HDWalletInfo;
  transport: GridPlusTransport;
  client?: Client;

  constructor(transport: GridPlusTransport) {
    this.transport = transport;
    this.info = new GridPlusWalletInfo();
  }

  async getFeatures(): Promise<Record<string, any>> {
    return {
      vendor: "GridPlus",
      majorVersion: 1,
      minorVersion: 0,
      patchVersion: 0,
      deviceId: this.transport.deviceId,
      model: "Lattice1",
      firmwareVariant: "regular",
    };
  }

  public async isLocked(): Promise<boolean> {
    return !this.transport.isConnected();
  }

  public async clearSession(): Promise<void> {
    console.log(`[GridPlus DEBUG] [${this.instanceId}] clearSession() called - clearing cache, client, and pending requests`);
    if (this.client) {
      await this.transport.disconnect();
      this.client = undefined;
      // Clear cached addresses when session ends
      this.addressCache.clear();
      // Clear pending requests
      this.pendingRequests.clear();
      console.log(`[GridPlus DEBUG] [${this.instanceId}] Session cleared - client, address cache (${this.addressCache.size} entries), and pending requests reset`);
    }
  }

  public async isInitialized(): Promise<boolean> {
    return !!this.client;
  }

  public async initialize(): Promise<void> {
    console.log(`[GridPlus DEBUG] initialize() called - instanceId: ${this.instanceId}`);
    // Get the GridPlus client from transport after successful pairing
    this.client = this.transport.getClient();
    
    console.log(`[GridPlus DEBUG] Client status after transport.getClient():`, {
      clientExists: !!this.client,
      clientType: typeof this.client,
      hasGetAddresses: this.client ? typeof this.client.getAddresses === 'function' : false,
      instanceId: this.instanceId
    });
    
    if (!this.client) {
      console.error(`[GridPlus DEBUG] [${this.instanceId}] No client from transport - device may not be paired`);
      throw new Error("GridPlus client not available - device may not be paired");
    }
    
    // Validate that the client has the expected methods
    if (typeof this.client.getAddresses !== 'function') {
      console.error(`[GridPlus DEBUG] [${this.instanceId}] Client missing getAddresses method`);
      throw new Error("GridPlus client missing required getAddresses method");
    }

    console.log(`[GridPlus DEBUG] [${this.instanceId}] initialize() completed successfully`);
  }

  public async ping(msg: core.Ping): Promise<core.Pong> {
    return { msg: msg.msg };
  }

  public async sendPin(): Promise<void> {
    // Placeholder for PIN functionality
  }

  public async sendPassphrase(): Promise<void> {
    // Placeholder for passphrase functionality  
  }

  public async sendCharacter(): Promise<void> {
    // Placeholder for character input functionality
  }

  public async sendWord(): Promise<void> {
    // Placeholder for word input functionality
  }

  public async cancel(): Promise<void> {
    await this.clearSession();
  }

  public async wipe(): Promise<void> {
    throw new Error("GridPlus does not support wiping");
  }

  public async reset(): Promise<void> {
    await this.clearSession();
    await this.initialize();
  }

  public async recover(): Promise<void> {
    throw new Error("GridPlus does not support recovery mode");
  }

  public async loadDevice(): Promise<void> {
    throw new Error("GridPlus does not support device loading");
  }

  public describePath(): core.PathDescription {
    return {
      verbose: "GridPlus does not support path descriptions yet",
      coin: "Unknown",
      isKnown: false,
    };
  }

  public async getPublicKeys(): Promise<core.PublicKey[]> {
    throw new Error("GridPlus public key retrieval not implemented yet");
  }

  public hasOnDevicePinEntry(): boolean {
    return true;
  }

  public hasOnDevicePassphrase(): boolean {
    return true;
  }

  public hasOnDeviceDisplay(): boolean {
    return true;
  }

  public hasOnDeviceRecovery(): boolean {
    return false;
  }

  public hasNativeShapeShift(srcCoin: string, dstCoin: string): boolean {
    return false;
  }

  public supportsBip44Accounts(): boolean {
    const supports = true;
    console.log(`[GridPlus DEBUG] supportsBip44Accounts() called - returning:`, {
      supports,
      instanceId: 'gridplus-wallet-info',
      timestamp: new Date().toISOString(),
      callStack: new Error().stack?.split('\n').slice(1, 3).map(line => line.trim()).join(' → ')
    });
    return supports;
  }

  public supportsOfflineSigning(): boolean {
    return true;
  }

  public supportsBroadcast(): boolean {
    return false;
  }

  public getVendor(): string {
    return "GridPlus";
  }

  public async getModel(): Promise<string> {
    return "Lattice1";
  }

  public async getLabel(): Promise<string> {
    return "GridPlus Lattice1";
  }

  public async getFirmwareVersion(): Promise<string> {
    return "1.0.0";
  }

  public async getDeviceID(): Promise<string> {
    return await this.transport.getDeviceID();
  }

  public getPrivKey(): string | undefined {
    return this.transport.getPrivKey();
  }

  public async disconnect(): Promise<void> {
    await this.clearSession();
  }

  // ETH Wallet Methods
  public async ethSupportsNetwork(chainId: number): Promise<boolean> {
    // Support major EVM networks
    const supportedChains = [
      1,     // Ethereum mainnet
      137,   // Polygon
      10,    // Optimism
      42161, // Arbitrum
      8453,  // Base
      56,    // BSC
      100,   // Gnosis
      43114, // Avalanche
    ];
    const isSupported = supportedChains.includes(chainId);
    console.log('[GridPlus DEBUG] ethSupportsNetwork check:', {
      chainId,
      chainIdType: typeof chainId,
      isSupported,
      allSupportedChains: supportedChains,
      timestamp: new Date().toISOString()
    });
    return isSupported;
  }

  public async ethSupportsSecureTransfer(): Promise<boolean> {
    return false; // GridPlus doesn't support internal transfers
  }

  public ethSupportsNativeShapeShift(): boolean {
    return false; // GridPlus doesn't support native ShapeShift
  }

  public async ethSupportsEIP1559(): Promise<boolean> {
    return true; // Modern EVM support
  }

  public ethGetAccountPaths(msg: core.ETHGetAccountPath): Array<core.ETHAccountPath> {
    const slip44 = core.slip44ByCoin(msg.coin);
    console.log('[GridPlus DEBUG] ethGetAccountPaths called:', {
      coin: msg.coin,
      coinType: typeof msg.coin,
      accountIdx: msg.accountIdx,
      slip44,
      slip44Type: typeof slip44,
      timestamp: new Date().toISOString(),
      callStack: new Error().stack?.slice(0, 300)
    });
    
    if (slip44 === undefined) {
      console.warn('[GridPlus DEBUG] Unsupported coin for ethGetAccountPaths:', {
        coin: msg.coin,
        availableSlip44: 'ETH should be 60'
      });
      return [];
    }
    
    const addressNList = [0x80000000 + 44, 0x80000000 + slip44, 0x80000000 + msg.accountIdx, 0, 0];
    const hardenedPath = [0x80000000 + 44, 0x80000000 + slip44, 0x80000000 + msg.accountIdx];
    const paths = [
      {
        addressNList,
        hardenedPath,
        relPath: [0, 0],
        description: `GridPlus-${msg.coin}-${msg.accountIdx}`, // Make description unique per coin/account
      },
    ];
    
    console.log('[GridPlus DEBUG] Generated account paths:', {
      coin: msg.coin,
      slip44,
      accountIdx: msg.accountIdx,
      addressNList,
      hardenedPath,
      pathCount: paths.length,
      description: paths[0].description
    });
    return paths;
  }

  public ethNextAccountPath(msg: core.ETHAccountPath): core.ETHAccountPath | undefined {
    const addressNList = msg.hardenedPath.concat(msg.relPath);
    const description = core.describeETHPath(addressNList);
    if (!description.isKnown || description.accountIdx === undefined) {
      return undefined;
    }

    const newAddressNList = [...addressNList];
    newAddressNList[2] += 1; // Increment account index
    
    return {
      addressNList: newAddressNList,
      hardenedPath: [newAddressNList[0], newAddressNList[1], newAddressNList[2]],
      relPath: [0, 0],
      description: "GridPlus",
    };
  }

  public async ethGetAddress(msg: core.ETHGetAddress): Promise<core.Address | null> {
    const callId = `${this.instanceId}-${++this.callCounter}`;
    const stackTrace = new Error().stack?.split('\n').slice(1, 4).map(line => line.trim()).join(' → ');
    
    console.log(`[GridPlus DEBUG] ===== NEW ethGetAddress CALL START [${callId}] =====`);
    // Create cache key from derivation path
    const pathKey = JSON.stringify(msg.addressNList);
    const cachedAddress = this.addressCache.get(pathKey);
    
    console.log('[GridPlus DEBUG] Call details:', {
      callId,
      instanceId: 'gridplus-wallet-info',
      addressNList: msg.addressNList,
      showDisplay: msg.showDisplay,
      timestamp: new Date().toISOString(),
      pathKey,
      cachedAddress,
      cacheStatus: cachedAddress ? 'HIT' : 'MISS',
      totalCacheEntries: this.addressCache.size,
      callStack: stackTrace,
      supportsBip44Accounts: this.supportsBip44Accounts(),
      clientConnected: !!this.client
    });

    // Return cached address if available (per-account caching)
    if (cachedAddress) {
      console.log(`[GridPlus DEBUG] CACHE HIT [${callId}] - Returning cached EVM address for path:`, {
        pathKey,
        address: cachedAddress,
        callId
      });
      console.log(`[GridPlus DEBUG] ===== ethGetAddress CALL END [${callId}] (CACHED) =====`);
      return cachedAddress;
    }
    
    console.log(`[GridPlus DEBUG] CACHE MISS [${callId}] - Need to derive address from device for path:`, pathKey);

    // Check if there's already a pending request for this exact path
    const existingRequest = this.pendingRequests.get(pathKey);
    if (existingRequest) {
      console.log(`[GridPlus DEBUG] REQUEST DEDUPLICATION [${callId}] - Found existing request for path:`, {
        pathKey,
        pendingRequestsCount: this.pendingRequests.size,
        callId
      });
      console.log(`[GridPlus DEBUG] [${callId}] ⏳ WAITING for existing request to complete...`);
      
      try {
        const result = await existingRequest;
        console.log(`[GridPlus DEBUG] [${callId}] ✅ DEDUPLICATION SUCCESS - Existing request completed:`, result);
        console.log(`[GridPlus DEBUG] ===== ethGetAddress CALL END [${callId}] (DEDUPLICATED) =====`);
        return result;
      } catch (error) {
        console.error(`[GridPlus DEBUG] [${callId}] ❌ DEDUPLICATION ERROR - Existing request failed:`, error);
        console.log(`[GridPlus DEBUG] ===== ethGetAddress CALL END [${callId}] (DEDUPLICATED_ERROR) =====`);
        throw error;
      }
    }

    if (!this.client) {
      console.error(`[GridPlus DEBUG] [${callId}] Device not connected`);
      throw new Error("Device not connected");
    }

    // Additional validation
    if (typeof this.client.getAddresses !== 'function') {
      console.error(`[GridPlus DEBUG] [${callId}] Client missing getAddresses method`);
      throw new Error("GridPlus client does not have getAddresses method");
    }
    
    console.log(`[GridPlus DEBUG] [${callId}] Connection validated - proceeding with GridPlus SDK call`);
    console.log(`[GridPlus DEBUG] [${callId}] NEW REQUEST - Adding to pending requests map:`, {
      pathKey,
      pendingRequestsCount: this.pendingRequests.size,
      callId
    });

    // Create the request Promise and add it to pending requests
    const requestPromise = this.performAddressRequest(msg, callId);
    this.pendingRequests.set(pathKey, requestPromise);

    try {
      const result = await requestPromise;
      console.log(`[GridPlus DEBUG] [${callId}] ✅ REQUEST COMPLETED - Removing from pending:`, {
        pathKey,
        result,
        pendingRequestsCountBefore: this.pendingRequests.size
      });
      this.pendingRequests.delete(pathKey);
      console.log(`[GridPlus DEBUG] [${callId}] Pending requests count after removal:`, this.pendingRequests.size);
      console.log(`[GridPlus DEBUG] ===== ethGetAddress CALL END [${callId}] (SUCCESS) =====`);
      return result;
    } catch (error) {
      console.error(`[GridPlus DEBUG] [${callId}] ❌ REQUEST FAILED - Removing from pending:`, {
        pathKey,
        // TODO: remove highlander-based-development
        error: (error as any)?.message,
        pendingRequestsCountBefore: this.pendingRequests.size
      });
      this.pendingRequests.delete(pathKey);
      console.log(`[GridPlus DEBUG] [${callId}] Pending requests count after error removal:`, this.pendingRequests.size);
      console.log(`[GridPlus DEBUG] ===== ethGetAddress CALL END [${callId}] (ERROR) =====`);
      throw error;
    }
  }

  private async performAddressRequest(msg: core.ETHGetAddress, callId: string): Promise<core.Address | null> {
    try {
      console.log(`[GridPlus DEBUG] [${callId}] Making client.getAddresses request:`, {
        startPath: msg.addressNList,
        n: 1,
        flag: 0,
        clientType: typeof this.client,
        callId
      });
      console.log(`[GridPlus DEBUG] [${callId}] ⏳ CALLING GridPlus SDK (this may retry internally)...`);
      
      // Use direct client.getAddresses call (like Frame does) with default flag 0 for EVM
      const addresses = await this.client!.getAddresses({
        startPath: msg.addressNList,
        n: 1,
        flag: 0 // EVM default - returns 0x addresses
      });
      
      console.log(`[GridPlus DEBUG] [${callId}] ✅ GridPlus SDK call completed successfully`);

      console.log(`[GridPlus DEBUG] [${callId}] Raw response received:`, {
        addresses,
        responseType: typeof addresses,
        responseLength: addresses?.length,
        isArray: Array.isArray(addresses),
        callId
      });

      if (!addresses || !addresses.length) {
        console.error(`[GridPlus DEBUG] [${callId}] Empty response from client.getAddresses`);
        throw new Error("No address returned from device");
      }

      const rawAddress = addresses[0];
      let address: string;
      
      // Handle response format (could be Buffer or string)
      if (Buffer.isBuffer(rawAddress)) {
        address = '0x' + rawAddress.toString('hex');
      } else {
        address = rawAddress.toString();
      }
      
      console.log(`[GridPlus DEBUG] [${callId}] Processed address:`, {
        rawAddress,
        address,
        rawType: typeof rawAddress,
        callId
      });
      
      // Validate the address format
      if (!address || typeof address !== 'string') {
        console.error(`[GridPlus DEBUG] [${callId}] Invalid address format received:`, {
          address,
          addressType: typeof address,
          callId
        });
        throw new Error("Invalid address format returned from device");
      }
      
      // Ensure address starts with 0x for EVM
      if (!address.startsWith('0x')) {
        address = '0x' + address;
      }
      
      // Validate Ethereum address format (should be 42 chars with 0x prefix)
      if (address.length !== 42) {
        console.error(`[GridPlus DEBUG] [${callId}] Address does not match Ethereum format:`, {
          address,
          addressLength: address.length,
          expectedLength: 42,
          callId
        });
        throw new Error(`Invalid Ethereum address length: ${address}`);
      }
      
      console.log(`[GridPlus DEBUG] [${callId}] Successfully derived valid EVM address:`, {
        address,
        addressType: typeof address,
        addressLength: address.length,
        path: msg.addressNList,
        callId
      });
      
      // Cache the address for future calls (per account path)
      const pathKey = JSON.stringify(msg.addressNList);
      console.log(`[GridPlus DEBUG] [${callId}] 💾 CACHING address for future calls:`, {
        address,
        pathKey,
        accountPath: msg.addressNList,
        callId
      });
      // TODO: remove highlander-based-development
      // @ts-ignore
      this.addressCache.set(pathKey, address);
      console.log(`[GridPlus DEBUG] [${callId}] Cache status after set:`, { 
        totalCacheEntries: this.addressCache.size,
        cachedForPath: this.addressCache.get(pathKey),
        cacheSet: this.addressCache.get(pathKey) === address,
        callId
      });
      
      // TODO: remove highlander-based-development
      // @ts-ignore
      return address;
    } catch (error) {
      console.error(`[GridPlus DEBUG] [${callId}] ❌ ethGetAddress error details:`, {
        error,
        // TODO: remove highlander-based-development
        errorMessage: (error as any)?.message,
        errorName: (error as any)?.name,
        responseCode: (error as any)?.responseCode,
        isLatticeResponseError: error?.constructor?.name === 'LatticeResponseError',
        path: msg.addressNList,
        timestamp: new Date().toISOString(),
        callId,
        instanceId: this.instanceId
      });
      throw error;
    }
  }


  // Solana Wallet Methods
  public solanaGetAccountPaths(msg: core.SolanaGetAccountPaths): Array<core.SolanaAccountPath> {
    console.log('[GridPlus DEBUG] solanaGetAccountPaths called for account:', msg.accountIdx);
    // Use proper hardened derivation path: m/44'/501'/accountIdx'/0'
    return [{ addressNList: [0x80000000 + 44, 0x80000000 + 501, 0x80000000 + msg.accountIdx, 0x80000000 + 0] }];
  }

  public async solanaGetAddress(msg: core.SolanaGetAddress): Promise<string | null> {
    console.log('[GridPlus DEBUG] solanaGetAddress called with:', {
      addressNList: msg.addressNList,
      showDisplay: msg.showDisplay,
      timestamp: new Date().toISOString(),
      supportsSolana: this._supportsSolana,
      callStack: new Error().stack?.slice(0, 500)
    });

    if (!this.client) {
      console.error('[GridPlus DEBUG] Solana - Device not connected');
      throw new Error("Device not connected");
    }

    try {
      console.log('[GridPlus DEBUG] Making Solana client.getAddresses request:', {
        startPath: msg.addressNList,
        n: 1,
        flag: Constants.GET_ADDR_FLAGS.ED25519_PUB,
        pathValidation: {
          pathLength: msg.addressNList.length,
          expectedSolanaFormat: '[44+hardened, 501+hardened, account+hardened, change+hardened]',
          actualPath: msg.addressNList
        }
      });

      // Validate that this looks like a proper Solana derivation path
      // Solana typically uses: m/44'/501'/account'/change' (all hardened)
      if (msg.addressNList.length >= 2) {
        const purpose = msg.addressNList[0];
        const coinType = msg.addressNList[1];
        const expectedPurpose = 0x80000000 + 44; // m/44'
        const expectedCoinType = 0x80000000 + 501; // 501 is Solana coin type
        
        if (purpose !== expectedPurpose || coinType !== expectedCoinType) {
          console.warn('[GridPlus DEBUG] Path may not be valid for Solana:', {
            actualPath: msg.addressNList,
            expectedStart: [expectedPurpose, expectedCoinType],
            actualStart: [purpose, coinType]
          });
        }
      }

      // Use direct client.getAddresses with ED25519 flag for Solana
      const addresses = await this.client.getAddresses({
        startPath: msg.addressNList,
        n: 1,
        flag: Constants.GET_ADDR_FLAGS.ED25519_PUB
      });

      console.log('[GridPlus DEBUG] Solana response received:', {
        addresses,
        responseType: typeof addresses,
        responseLength: addresses?.length,
        isArray: Array.isArray(addresses)
      });

      if (!addresses || !addresses.length) {
        console.error('[GridPlus DEBUG] Empty Solana response from client.getAddresses');
        throw new Error("No address returned from device");
      }

      const rawSolanaAddress = addresses[0];
      let solanaAddress: string;
      
      // Handle response format (should be string for ED25519/Solana)
      if (Buffer.isBuffer(rawSolanaAddress)) {
        solanaAddress = rawSolanaAddress.toString();
      } else {
        solanaAddress = rawSolanaAddress.toString();
      }
      console.log('[GridPlus DEBUG] Processed Solana address:', {
        rawSolanaAddress,
        solanaAddress,
        rawType: typeof rawSolanaAddress,
        processedType: typeof solanaAddress,
        addressLength: solanaAddress?.length,
        isBase58: typeof solanaAddress === 'string' ? /^[1-9A-HJ-NP-Za-km-z]+$/.test(solanaAddress) : false
      });

      // Validate it's a proper Solana address (should be base58, not 0x)
      if (!solanaAddress || typeof solanaAddress !== 'string') {
        console.error('[GridPlus DEBUG] Invalid Solana address format:', { solanaAddress });
        throw new Error("Invalid Solana address format returned from device");
      }

      if (solanaAddress.startsWith('0x')) {
        console.error('[GridPlus DEBUG] Received EVM address instead of Solana address:', { 
          solanaAddress,
          expectedFormat: 'base58 (e.g., 9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM)'
        });
        throw new Error("Received EVM address format instead of Solana base58 address");
      }

      // Additional validation - Solana addresses are typically 32-44 characters in base58
      if (solanaAddress.length < 32 || solanaAddress.length > 44) {
        console.warn('[GridPlus DEBUG] Solana address length seems unusual:', {
          solanaAddress,
          addressLength: solanaAddress.length,
          expectedRange: '32-44 characters'
        });
      }

      console.log('[GridPlus DEBUG] Successfully derived valid Solana address:', {
        solanaAddress,
        addressLength: solanaAddress.length,
        path: msg.addressNList,
        flag: Constants.GET_ADDR_FLAGS.ED25519_PUB
      });

      return solanaAddress;
    } catch (error) {
      console.error('[GridPlus DEBUG] solanaGetAddress error details:', {
        error,
        // TODO: remove highlander-based-development
        errorMessage: (error as any)?.message,
        errorName: (error as any)?.name,
        path: msg.addressNList,
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }

  public async solanaSignTx(msg: core.SolanaSignTx): Promise<core.SolanaSignedTx | null> {
    throw new Error("GridPlus Solana transaction signing not implemented yet");
  }

  public solanaNextAccountPath(msg: core.SolanaAccountPath): core.SolanaAccountPath | undefined {
    // Increment account index for next account
    const newAddressNList = [...msg.addressNList];
    newAddressNList[2] += 1; // Increment account index
    
    return {
      addressNList: newAddressNList,
    };
  }

  // TODO: remove highlander-based-development
  // @ts-ignore
  public async ethSignTx(msg: core.ETHSignTx): Promise<core.ETHSignedTx> {
    console.log("🟦 [GridPlus] ethSignTx START", {
      msgKeys: Object.keys(msg),
      timestamp: new Date().toISOString()
    });

    // Log input transaction details
    console.log("🟦 [GridPlus] INPUT TRANSACTION:", {
      to: msg.to,
      value: msg.value,
      data: msg.data ? `${msg.data.slice(0, 20)}...` : null,
      nonce: msg.nonce,
      gasLimit: msg.gasLimit,
      maxFeePerGas: msg.maxFeePerGas,
      maxPriorityFeePerGas: msg.maxPriorityFeePerGas,
      gasPrice: msg.gasPrice,
      chainId: msg.chainId,
      addressNList: msg.addressNList
    });

    try {
      if (!this.client) {
        throw new Error("Device not connected");
      }

      // Prepare unsigned transaction data (common fields)
      const unsignedTxBase = {
        to: msg.to,
        value: msg.value,
        data: msg.data,
        nonce: msg.nonce,
        gasLimit: msg.gasLimit,
        chainId: msg.chainId,
      };

      // Log constructed transaction object
      console.log("🟦 [GridPlus] CONSTRUCTED TRANSACTION OBJECT:", {
        ...unsignedTxBase,
        maxFeePerGas: msg.maxFeePerGas,
        maxPriorityFeePerGas: msg.maxPriorityFeePerGas,
        gasPrice: msg.gasPrice,
        type: msg.maxFeePerGas ? "eip1559" : "legacy"
      });

      // Serialize unsigned transaction for signing using ethereumjs/tx
      // For EIP-1559 transactions, we need to specify the 'london' hardfork to enable EIP-1559 support
      const common = msg.maxFeePerGas
        ? Common.custom({ chainId: msg.chainId }, { hardfork: 'london' })
        : Common.custom({ chainId: msg.chainId });
      const unsignedTx = msg.maxFeePerGas
        ? FeeMarketEIP1559Transaction.fromTxData({
            ...unsignedTxBase,
            maxFeePerGas: msg.maxFeePerGas,
            maxPriorityFeePerGas: msg.maxPriorityFeePerGas,
          }, { common })
        : Transaction.fromTxData({ ...unsignedTxBase, gasPrice: msg.gasPrice }, { common });

      // Get the payload for GridPlus general signing
      // For EIP-1559 (type 2): use raw Buffer from getMessageToSign
      // For legacy: RLP-encode the message first
      const payload = msg.maxFeePerGas
        ? unsignedTx.getMessageToSign(false)  // EIP-1559: raw Buffer
        : encode(unsignedTx.getMessageToSign(false));  // Legacy: RLP-encoded Buffer

      console.log("🟦 [GridPlus] TRANSACTION SERIALIZATION:", {
        payloadType: Buffer.isBuffer(payload) ? 'Buffer' : typeof payload,
        payloadLength: Buffer.isBuffer(payload) ? payload.length : 'N/A',
        payloadHex: Buffer.isBuffer(payload) ? `0x${payload.toString('hex').slice(0, 40)}...` : 'N/A',
        isEIP1559: !!msg.maxFeePerGas
      });

      // Fetch calldata decoder for clear signing on device
      const callDataDecoder = msg.to
        ? await Utils.fetchCalldataDecoder(msg.data, msg.to, msg.chainId)
        : undefined;

      // Use GridPlus general signing (no currency field = general signing mode)
      // General signing requires fw >= v0.15.0
      const signingData = {
        data: {
          payload,
          curveType: Constants.SIGNING.CURVES.SECP256K1,
          hashType: Constants.SIGNING.HASHES.KECCAK256,
          encodingType: Constants.SIGNING.ENCODINGS.EVM,
          signerPath: msg.addressNList,
          decoder: callDataDecoder?.def
        }
        // NO currency field - this enables general signing mode
      };

      console.log("🟦 [GridPlus] SIGNING REQUEST:", {
        mode: 'GENERAL_SIGNING',
        payloadType: Buffer.isBuffer(signingData.data.payload) ? 'Buffer' : typeof signingData.data.payload,
        payloadLength: Buffer.isBuffer(signingData.data.payload) ? signingData.data.payload.length : 'N/A',
        curveType: signingData.data.curveType,
        hashType: signingData.data.hashType,
        encodingType: signingData.data.encodingType,
        signerPath: signingData.data.signerPath
      });

      // TODO: remove highlander-based-development
      // @ts-ignore - GridPlus SDK external typing
      const signedResult = await this.client.sign(signingData);

      console.log("🟦 [GridPlus] SIGNING RESPONSE:", {
        hasResult: !!signedResult,
        hasSig: !!signedResult?.sig,
        sigKeys: signedResult?.sig ? Object.keys(signedResult.sig) : null
      });

      if (!signedResult?.sig) {
        throw new Error("No signature returned from device");
      }

      const { r, s, v } = signedResult.sig;

      // Log raw signature components
      console.log("🟦 [GridPlus] RAW SIGNATURE COMPONENTS:", {
        r: {
          type: typeof r,
          isBuffer: Buffer.isBuffer(r),
          value: Buffer.isBuffer(r) ? `0x${r.toString('hex')}` : r
        },
        s: {
          type: typeof s,
          isBuffer: Buffer.isBuffer(s),
          value: Buffer.isBuffer(s) ? `0x${s.toString('hex')}` : s
        },
        v: {
          type: typeof v,
          isBuffer: Buffer.isBuffer(v),
          value: Buffer.isBuffer(v) ? v.readUInt8(0) : v
        }
      });

      // Process signature components
      try {
        console.log("🟦 [GridPlus] DEBUG: Starting signature processing");
        const rHex = "0x" + (Buffer.isBuffer(r) ? r.toString('hex') : core.toHexString(r));
        console.log("🟦 [GridPlus] DEBUG: rHex processed:", rHex.slice(0, 20));
        const sHex = "0x" + (Buffer.isBuffer(s) ? s.toString('hex') : core.toHexString(s));
        console.log("🟦 [GridPlus] DEBUG: sHex processed:", sHex.slice(0, 20));

        // For general signing, v is returned as Buffer/number and can be used directly
        // @ethereumjs/tx will handle the proper v value format for EIP-1559 vs legacy
        const vHex = "0x" + (Buffer.isBuffer(v) ? v.toString('hex') : core.toHexString(v));
        console.log("🟦 [GridPlus] DEBUG: v value (direct):", Buffer.isBuffer(v) ? v.readUInt8(0) : v, "hex:", vHex);

        console.log("🟦 [GridPlus] PROCESSED SIGNATURE COMPONENTS:", {
          rHex,
          sHex,
          vHex,
          isEIP1559: !!msg.maxFeePerGas,
        });

        // Create signed transaction using ethereumjs/tx
        // This library properly handles EIP-1559 vs legacy transaction formats
        const signedTx = msg.maxFeePerGas
          ? FeeMarketEIP1559Transaction.fromTxData({
              ...unsignedTxBase,
              maxFeePerGas: msg.maxFeePerGas,
              maxPriorityFeePerGas: msg.maxPriorityFeePerGas,
              r: rHex,
              s: sHex,
              v: vHex,
            }, { common })
          : Transaction.fromTxData({
              ...unsignedTxBase,
              gasPrice: msg.gasPrice,
              r: rHex,
              s: sHex,
              v: vHex,
            }, { common });

        // Serialize the signed transaction
        const finalSerializedTx = `0x${signedTx.serialize().toString('hex')}`;

        console.log("🟦 [GridPlus] FINAL SERIALIZATION:", {
          serializedTx: `${finalSerializedTx.slice(0, 50)}...${finalSerializedTx.slice(-20)}`,
          serializedLength: finalSerializedTx.length
        });

        // Return v as the raw value from GridPlus (not converted)
        const vRaw = Buffer.isBuffer(v) ? v.readUInt8(0) : v;

        const result = {
          r: rHex,
          s: sHex,
          v: vRaw,
          serialized: finalSerializedTx,
        };

        console.log("🟦 [GridPlus] ethSignTx FINAL RESULT:", {
          r: result.r,
          s: result.s,
          v: result.v,
          serializedLength: result.serialized.length,
          timestamp: new Date().toISOString()
        });

        return result;
      } catch (error) {
        console.error("🟦 [GridPlus] ERROR processing signature:", error);
        console.error("🟦 [GridPlus] Error stack:", error instanceof Error ? error.stack : 'no stack');
        throw error;
      }
    } catch (error) {
      console.error("GridPlusHDWallet.ethSignTx error", error);
      throw error;
    }
  }

  // TODO: remove highlander-based-development
  // @ts-ignore
  public async ethSignTypedData(msg: core.ETHSignTypedData): Promise<core.ETHSignedTypedData> {
    console.log("🟦 [GridPlus EIP-712] START ethSignTypedData", {
      addressNList: msg.addressNList,
      primaryType: msg.typedData.primaryType,
      hasDomain: !!msg.typedData.domain,
      hasTypes: !!msg.typedData.types,
      hasMessage: !!msg.typedData.message,
    });

    try {
      if (!this.client) {
        throw new Error("Device not connected");
      }

      // Hash the EIP-712 data ourselves (like KeepKey does)
      // This avoids the browser polyfill issues with SDK's internal CBOR encoding
      const digest = TypedDataUtils.eip712Hash(
        msg.typedData as any,  // Type assertion for @metamask/eth-sig-util compatibility
        SignTypedDataVersion.V4
      );

      console.log("🟦 [GridPlus EIP-712] Computed digest:", {
        digestHex: `0x${Buffer.from(digest).toString('hex')}`,
        digestLength: digest.length,
      });

      // Use general signing with the pre-hashed digest (like transaction signing)
      // NO currency field = general signing mode (avoids legacy ETH_MSG pathway)
      const signingData = {
        data: {
          payload: Buffer.from(digest),  // Raw 32-byte hash
          curveType: Constants.SIGNING.CURVES.SECP256K1,
          hashType: Constants.SIGNING.HASHES.NONE,  // Already hashed!
          encodingType: Constants.SIGNING.ENCODINGS.NONE,  // Raw hash, not a transaction
          signerPath: msg.addressNList,
        }
        // NO currency field - this enables general signing mode
      };

      console.log("🟦 [GridPlus EIP-712] SIGNING REQUEST:", {
        mode: 'GENERAL_SIGNING',
        payloadType: Buffer.isBuffer(signingData.data.payload) ? 'Buffer' : typeof signingData.data.payload,
        payloadLength: Buffer.isBuffer(signingData.data.payload) ? signingData.data.payload.length : 'N/A',
        curveType: signingData.data.curveType,
        hashType: signingData.data.hashType,
        encodingType: signingData.data.encodingType,
        signerPath: signingData.data.signerPath
      });

      // TODO: remove highlander-based-development
      // @ts-ignore - GridPlus SDK external typing
      const signedResult = await this.client.sign(signingData);

      console.log("🟦 [GridPlus EIP-712] SIGNING RESPONSE:", {
        hasResult: !!signedResult,
        hasSig: !!signedResult?.sig,
        sigKeys: signedResult?.sig ? Object.keys(signedResult.sig) : null
      });

      if (!signedResult?.sig) {
        throw new Error("No signature returned from device");
      }

      const { r, s, v } = signedResult.sig;

      console.log("🟦 [GridPlus EIP-712] RAW SIGNATURE COMPONENTS:", {
        r: {
          type: typeof r,
          isBuffer: Buffer.isBuffer(r),
          value: Buffer.isBuffer(r) ? `0x${r.toString('hex')}` : r
        },
        s: {
          type: typeof s,
          isBuffer: Buffer.isBuffer(s),
          value: Buffer.isBuffer(s) ? `0x${s.toString('hex')}` : s
        },
        v: {
          type: typeof v,
          isBuffer: Buffer.isBuffer(v),
          value: Buffer.isBuffer(v) ? v.readUInt8(0) : v
        }
      });

      // Get the address for the response
      const addressResult = await this.ethGetAddress({
        addressNList: msg.addressNList,
        showDisplay: false,
      });

      // Format signature components (same as transaction signing)
      const rHex = "0x" + (Buffer.isBuffer(r) ? r.toString('hex') : core.toHexString(r));
      const sHex = "0x" + (Buffer.isBuffer(s) ? s.toString('hex') : core.toHexString(s));
      const vValue = Buffer.isBuffer(v) ? v.readUInt8(0) : (v as number);

      // For EIP-712, v should be 27 or 28 (standard Ethereum signature)
      const vHex = "0x" + vValue.toString(16);
      const signature = rHex + sHex.slice(2) + vHex.slice(2);

      console.log("🟦 [GridPlus EIP-712] FORMATTED SIGNATURE:", {
        address: addressResult,
        signature,
        signatureLength: signature.length,
        r: rHex,
        s: sHex,
        v: vValue,
        vHex,
      });

      return {
        // TODO: remove highlander-based-development
        // @ts-ignore
        address: addressResult,
        signature: signature,
      };
    } catch (error) {
      console.error("🟦 [GridPlus EIP-712] ERROR:", error);
      throw error;
    }
  }

  // TODO: remove highlander-based-development
  public async ethSignMessage(msg: core.ETHSignMessage): Promise<core.ETHSignedMessage> {
    throw new Error("GridPlus ethSignMessage not implemented yet");
  }

  // TODO: remove highlander-based-development
  public async ethVerifyMessage(msg: core.ETHVerifyMessage): Promise<boolean> {
    throw new Error("GridPlus ethVerifyMessage not implemented yet");
  }
}

export class GridPlusWalletInfo implements core.HDWalletInfo, core.ETHWalletInfo {
  readonly _supportsGridPlusInfo = true;
  readonly _supportsETHInfo = true;
  readonly _supportsAvalanche = true;
  readonly _supportsOptimism = true;
  readonly _supportsPolygon = true;
  readonly _supportsGnosis = true;
  readonly _supportsArbitrum = true;
  readonly _supportsArbitrumNova = false;
  readonly _supportsBase = true;
  readonly _supportsBSC = true;
  readonly _supportsSolanaInfo = false;

  public getVendor(): string {
    return "GridPlus";
  }

  public hasOnDevicePinEntry(): boolean {
    return true;
  }

  public hasOnDevicePassphrase(): boolean {
    return true;
  }

  public hasOnDeviceDisplay(): boolean {
    return true;
  }

  public hasOnDeviceRecovery(): boolean {
    return false;
  }

  public hasNativeShapeShift(): boolean {
    return false;
  }

  public supportsBip44Accounts(): boolean {
    const supports = true;
    console.log(`[GridPlus DEBUG] supportsBip44Accounts() called - returning:`, {
      supports,
      instanceId: 'gridplus-wallet-info',
      timestamp: new Date().toISOString(),
      callStack: new Error().stack?.split('\n').slice(1, 3).map(line => line.trim()).join(' → ')
    });
    return supports;
  }

  public supportsOfflineSigning(): boolean {
    return true;
  }

  public supportsBroadcast(): boolean {
    return false;
  }

  public describePath(): core.PathDescription {
    return {
      verbose: "GridPlus path description not implemented",
      coin: "Unknown", 
      isKnown: false,
    };
  }

  // ETH Wallet Info Methods
  public async ethSupportsNetwork(chainId: number): Promise<boolean> {
    const supportedChains = [1, 137, 10, 42161, 8453, 56, 100, 43114];
    const isSupported = supportedChains.includes(chainId);
    console.log('[GridPlus DEBUG] WalletInfo ethSupportsNetwork check:', {
      chainId,
      isSupported,
      source: 'GridPlusWalletInfo'
    });
    return isSupported;
  }

  public async ethSupportsSecureTransfer(): Promise<boolean> {
    return false;
  }

  public ethSupportsNativeShapeShift(): boolean {
    return false;
  }

  public async ethSupportsEIP1559(): Promise<boolean> {
    return true;
  }

  public ethGetAccountPaths(msg: core.ETHGetAccountPath): Array<core.ETHAccountPath> {
    const slip44 = core.slip44ByCoin(msg.coin);
    if (slip44 === undefined) return [];
    
    return [
      {
        addressNList: [0x80000000 + 44, 0x80000000 + slip44, 0x80000000 + msg.accountIdx, 0, 0],
        hardenedPath: [0x80000000 + 44, 0x80000000 + slip44, 0x80000000 + msg.accountIdx],
        relPath: [0, 0],
        description: "GridPlus",
      },
    ];
  }

  public ethNextAccountPath(msg: core.ETHAccountPath): core.ETHAccountPath | undefined {
    const addressNList = msg.hardenedPath.concat(msg.relPath);
    const description = core.describeETHPath(addressNList);
    if (!description.isKnown || description.accountIdx === undefined) {
      return undefined;
    }

    const newAddressNList = [...addressNList];
    newAddressNList[2] += 1;
    
    return {
      addressNList: newAddressNList,
      hardenedPath: [newAddressNList[0], newAddressNList[1], newAddressNList[2]],
      relPath: [0, 0],
      description: "GridPlus",
    };
  }

  // Solana Wallet Info Methods
  public solanaGetAccountPaths(msg: core.SolanaGetAccountPaths): Array<core.SolanaAccountPath> {
    return [{ addressNList: [0x80000000 + 44, 0x80000000 + 501, 0x80000000 + msg.accountIdx, 0x80000000 + 0] }];
  }

  public solanaNextAccountPath(msg: core.SolanaAccountPath): core.SolanaAccountPath | undefined {
    // Increment account index for next account
    const newAddressNList = [...msg.addressNList];
    newAddressNList[2] += 1; // Increment account index
    
    return {
      addressNList: newAddressNList,
    };
  }

}