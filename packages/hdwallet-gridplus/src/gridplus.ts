import Common from "@ethereumjs/common";
import { FeeMarketEIP1559Transaction, Transaction } from "@ethereumjs/tx";
import { SignTypedDataVersion, TypedDataUtils } from "@metamask/eth-sig-util";
import * as core from "@shapeshiftoss/hdwallet-core";
import bs58 from "bs58";
import {
  Client,
  Constants,
  Utils,
  fetchSolanaAddresses,
  fetchBtcLegacyAddresses,
  fetchBtcSegwitAddresses,
  fetchBtcWrappedSegwitAddresses,
  signSolanaTx,
  signBtcLegacyTx,
  signBtcSegwitTx,
  signBtcWrappedSegwitTx,
} from "gridplus-sdk";
import isObject from "lodash/isObject";
import { encode } from "rlp";

import { GridPlusTransport } from "./transport";

export function isGridPlus(wallet: core.HDWallet): wallet is GridPlusHDWallet {
  return isObject(wallet) && (wallet as any)._isGridPlus;
}

export class GridPlusHDWallet implements core.HDWallet, core.ETHWallet, core.SolanaWallet, core.BTCWallet {
  readonly _isGridPlus = true;
  private addressCache = new Map<string, core.Address | string>();
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
  readonly _supportsSolana = true;
  readonly _supportsSolanaInfo = true;
  readonly _supportsBTC = true;
  readonly _supportsBTCInfo = true;

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
    if (this.client) {
      await this.transport.disconnect();
      this.client = undefined;
      // Clear cached addresses when session ends
      this.addressCache.clear();
      // Clear pending requests
      this.pendingRequests.clear();
    }
  }

  public async isInitialized(): Promise<boolean> {
    return !!this.client;
  }

  public async initialize(): Promise<void> {
    // Get the GridPlus client from transport after successful pairing
    this.client = this.transport.getClient();

    if (!this.client) {
      throw new Error("GridPlus client not available - device may not be paired");
    }

    // Validate that the client has the expected methods
    if (typeof this.client.getAddresses !== 'function') {
      throw new Error("GridPlus client missing required getAddresses method");
    }
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
    return true;
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
    return supportedChains.includes(chainId);
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

    if (slip44 === undefined) {
      return [];
    }

    const addressNList = [0x80000000 + 44, 0x80000000 + slip44, 0x80000000 + msg.accountIdx, 0, 0];
    const hardenedPath = [0x80000000 + 44, 0x80000000 + slip44, 0x80000000 + msg.accountIdx];
    return [
      {
        addressNList,
        hardenedPath,
        relPath: [0, 0],
        description: `GridPlus-${msg.coin}-${msg.accountIdx}`, // Make description unique per coin/account
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

    // Create cache key from derivation path
    const pathKey = JSON.stringify(msg.addressNList);
    const cachedAddress = this.addressCache.get(pathKey);

    // Return cached address if available (per-account caching)
    if (cachedAddress) {
      return cachedAddress as core.Address;
    }

    // Check if there's already a pending request for this exact path
    const existingRequest = this.pendingRequests.get(pathKey);
    if (existingRequest) {
      try {
        const result = await existingRequest;
        return result;
      } catch (error) {
        throw error;
      }
    }

    if (!this.client) {
      throw new Error("Device not connected");
    }

    // Additional validation
    if (typeof this.client.getAddresses !== 'function') {
      throw new Error("GridPlus client does not have getAddresses method");
    }

    // Create the request Promise and add it to pending requests
    const requestPromise = this.performAddressRequest(msg, callId);
    this.pendingRequests.set(pathKey, requestPromise);

    try {
      const result = await requestPromise;
      this.pendingRequests.delete(pathKey);
      return result;
    } catch (error) {
      this.pendingRequests.delete(pathKey);
      throw error;
    }
  }

  private async performAddressRequest(msg: core.ETHGetAddress, callId: string): Promise<core.Address | null> {
    try {
      // Use direct client.getAddresses call (like Frame does) with default flag 0 for EVM
      const addresses = await this.client!.getAddresses({
        startPath: msg.addressNList,
        n: 1,
        flag: 0 // EVM default - returns 0x addresses
      });

      if (!addresses || !addresses.length) {
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

      // Validate the address format
      if (!address || typeof address !== 'string') {
        throw new Error("Invalid address format returned from device");
      }

      // Ensure address starts with 0x for EVM
      if (!address.startsWith('0x')) {
        address = '0x' + address;
      }

      // Validate Ethereum address format (should be 42 chars with 0x prefix)
      if (address.length !== 42) {
        throw new Error(`Invalid Ethereum address length: ${address}`);
      }

      // Cache the address for future calls (per account path)
      const pathKey = JSON.stringify(msg.addressNList);
      // TODO: remove highlander-based-development
      // @ts-ignore
      this.addressCache.set(pathKey, address);

      // TODO: remove highlander-based-development
      // @ts-ignore
      return address;
    } catch (error) {
      throw error;
    }
  }


  // Solana Wallet Methods
  public solanaGetAccountPaths(msg: core.SolanaGetAccountPaths): Array<core.SolanaAccountPath> {
    // Use proper hardened derivation path: m/44'/501'/accountIdx'/0'
    return [{ addressNList: [0x80000000 + 44, 0x80000000 + 501, 0x80000000 + msg.accountIdx, 0x80000000 + 0] }];
  }

  public async solanaGetAddress(msg: core.SolanaGetAddress): Promise<string | null> {
    if (!this.client) {
      throw new Error("Device not connected");
    }

    // Check cache first
    const pathKey = JSON.stringify(msg.addressNList);
    const cachedAddress = this.addressCache.get(pathKey);
    if (cachedAddress) {
      return cachedAddress;
    }

    // Check firmware version supports ED25519
    const fwVersion = this.client.getFwVersion();

    if (fwVersion.major === 0 && fwVersion.minor < 14) {
      throw new Error(`Solana requires firmware >= 0.14.0, current: ${fwVersion.major}.${fwVersion.minor}.${fwVersion.fix}`);
    }

    try {
      // Extract account index from path: m/44'/501'/accountIdx'/0'
      // addressNList[2] contains the hardened account index
      const accountIdx = msg.addressNList[2] - 0x80000000;

      // Use SDK's fetchSolanaAddresses wrapper (fetches 10 addresses by default)
      // This works better than direct client.getAddresses for Solana
      const solanaAddresses = await fetchSolanaAddresses({
        n: 10,  // Fetch 10 addresses at once for better performance
        startPathIndex: accountIdx
      });

      if (!solanaAddresses || !solanaAddresses.length) {
        throw new Error("No address returned from device");
      }

      // Cache all 10 addresses to avoid re-fetching
      for (let i = 0; i < solanaAddresses.length; i++) {
        const addressBuffer = solanaAddresses[i];
        if (Buffer.isBuffer(addressBuffer)) {
          const address = bs58.encode(addressBuffer);
          // Create cache key for this account index
          const cacheKey = JSON.stringify([0x80000000 + 44, 0x80000000 + 501, 0x80000000 + (accountIdx + i), 0x80000000 + 0]);
          this.addressCache.set(cacheKey, address);
        }
      }

      // Return the requested address from cache
      const requestedAddress = this.addressCache.get(pathKey);
      if (!requestedAddress) {
        throw new Error("Failed to cache Solana address");
      }

      return requestedAddress;
    } catch (error) {
      throw error;
    }
  }

  public async solanaSignTx(msg: core.SolanaSignTx): Promise<core.SolanaSignedTx | null> {
    if (!this.client) {
      throw new Error("Device not connected");
    }

    try {
      const address = await this.solanaGetAddress({
        addressNList: msg.addressNList,
        showDisplay: false,
      });

      if (!address) throw new Error("Failed to get Solana address");

      const transaction = core.solanaBuildTransaction(msg, address);
      const serialized = transaction.serialize({
        requireAllSignatures: false,
        verifySignatures: false,
      });

      // Use GridPlus SDK's signSolanaTx wrapper
      const signData = await signSolanaTx(Buffer.from(serialized), {
        signerPath: msg.addressNList,
      });

      if (!signData || !signData.sig) {
        throw new Error("No signature returned from device");
      }

      return {
        serialized: Buffer.from(serialized).toString("base64"),
        signatures: [Buffer.from(signData.sig).toString("base64")],
      };
    } catch (error) {
      throw error;
    }
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

      // TODO: remove highlander-based-development
      // @ts-ignore - GridPlus SDK external typing
      const signedResult = await this.client.sign(signingData);

      if (!signedResult?.sig) {
        throw new Error("No signature returned from device");
      }

      const { r, s, v } = signedResult.sig;

      // Process signature components
      try {
        const rHex = "0x" + (Buffer.isBuffer(r) ? r.toString('hex') : core.toHexString(r));
        const sHex = "0x" + (Buffer.isBuffer(s) ? s.toString('hex') : core.toHexString(s));

        // For general signing, v is returned as Buffer/number and can be used directly
        // @ethereumjs/tx will handle the proper v value format for EIP-1559 vs legacy
        const vHex = "0x" + (Buffer.isBuffer(v) ? v.toString('hex') : core.toHexString(v));

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

        // Return v as the raw value from GridPlus (not converted)
        const vRaw = Buffer.isBuffer(v) ? v.readUInt8(0) : v;

        const result = {
          r: rHex,
          s: sHex,
          v: vRaw,
          serialized: finalSerializedTx,
        };

        return result;
      } catch (error) {
        throw error;
      }
    } catch (error) {
      throw error;
    }
  }

  // TODO: remove highlander-based-development
  // @ts-ignore
  public async ethSignTypedData(msg: core.ETHSignTypedData): Promise<core.ETHSignedTypedData> {
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

      // TODO: remove highlander-based-development
      // @ts-ignore - GridPlus SDK external typing
      const signedResult = await this.client.sign(signingData);

      if (!signedResult?.sig) {
        throw new Error("No signature returned from device");
      }

      const { r, s, v } = signedResult.sig;

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

      return {
        // TODO: remove highlander-based-development
        // @ts-ignore
        address: addressResult,
        signature: signature,
      };
    } catch (error) {
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
    return true;
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
    return supportedChains.includes(chainId);
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

  // Bitcoin Wallet Methods
  public async btcSupportsCoin(coin: core.Coin): Promise<boolean> {
    // Support Bitcoin and Dogecoin
    return ["Bitcoin", "Dogecoin", "Testnet"].includes(coin);
  }

  public async btcSupportsScriptType(coin: core.Coin, scriptType?: core.BTCInputScriptType): Promise<boolean> {
    const supported = {
      Bitcoin: [
        core.BTCInputScriptType.SpendAddress,      // p2pkh
        core.BTCInputScriptType.SpendP2SHWitness,  // p2sh-p2wpkh
        core.BTCInputScriptType.SpendWitness,      // p2wpkh
      ],
      Dogecoin: [core.BTCInputScriptType.SpendAddress],  // p2pkh only
      Testnet: [
        core.BTCInputScriptType.SpendAddress,
        core.BTCInputScriptType.SpendP2SHWitness,
        core.BTCInputScriptType.SpendWitness,
      ],
    } as Partial<Record<core.Coin, Array<core.BTCInputScriptType>>>;

    const scriptTypes = supported[coin];
    return !!scriptTypes && !!scriptType && scriptTypes.includes(scriptType);
  }

  public async btcSupportsSecureTransfer(): Promise<boolean> {
    return false;
  }

  public btcSupportsNativeShapeShift(): boolean {
    return false;
  }

  public btcGetAccountPaths(msg: core.BTCGetAccountPaths): Array<core.BTCAccountPath> {
    const slip44 = core.slip44ByCoin(msg.coin);
    const scriptTypes: core.BTCInputScriptType[] = [];

    if (msg.coin === "Dogecoin") {
      scriptTypes.push(core.BTCInputScriptType.SpendAddress);
    } else {
      scriptTypes.push(
        core.BTCInputScriptType.SpendAddress,
        core.BTCInputScriptType.SpendP2SHWitness,
        core.BTCInputScriptType.SpendWitness
      );
    }

    return scriptTypes.map(scriptType => {
      const purpose = this.scriptTypeToPurpose(scriptType);
      return {
        coin: msg.coin,
        scriptType,
        addressNList: [0x80000000 + purpose, 0x80000000 + slip44, 0x80000000 + (msg.accountIdx || 0), 0, 0],
      };
    });
  }

  public btcIsSameAccount(msg: Array<core.BTCAccountPath>): boolean {
    if (msg.length === 0) return false;
    const first = msg[0];
    return msg.every(
      path =>
        path.addressNList[0] === first.addressNList[0] &&
        path.addressNList[1] === first.addressNList[1] &&
        path.addressNList[2] === first.addressNList[2]
    );
  }

  public async btcGetAddress(msg: core.BTCGetAddress): Promise<string | null> {
    const pathKey = JSON.stringify(msg.addressNList);
    const cached = this.addressCache.get(pathKey);
    if (cached) return cached as string;

    const scriptType = msg.scriptType || core.BTCInputScriptType.SpendAddress;
    const accountIdx = msg.addressNList[2] - 0x80000000;

    // Choose fetch function based on script type
    const fetchFn =
      scriptType === core.BTCInputScriptType.SpendWitness
        ? fetchBtcSegwitAddresses
        : scriptType === core.BTCInputScriptType.SpendP2SHWitness
        ? fetchBtcWrappedSegwitAddresses
        : fetchBtcLegacyAddresses;

    const addresses = await fetchFn({ n: 10, startPathIndex: accountIdx });

    if (!addresses || !addresses.length) {
      throw new Error("No addresses returned from device");
    }

    // Cache all 10 addresses
    const purpose = this.scriptTypeToPurpose(scriptType);
    const slip44 = core.slip44ByCoin(msg.coin);
    for (let i = 0; i < addresses.length; i++) {
      const cacheKey = JSON.stringify([
        0x80000000 + purpose,
        0x80000000 + slip44,
        0x80000000 + (accountIdx + i),
        0,
        0,
      ]);
      this.addressCache.set(cacheKey, addresses[i]);
    }

    return (this.addressCache.get(pathKey) as string) || null;
  }

  public async btcSignTx(msg: core.BTCSignTx): Promise<core.BTCSignedTx | null> {
    if (!this.client) {
      throw new Error("Device not connected");
    }

    const scriptType = msg.inputs[0]?.scriptType || core.BTCInputScriptType.SpendAddress;

    // Choose sign function based on script type
    const signFn =
      scriptType === core.BTCInputScriptType.SpendWitness
        ? signBtcSegwitTx
        : scriptType === core.BTCInputScriptType.SpendP2SHWitness
        ? signBtcWrappedSegwitTx
        : signBtcLegacyTx;

    // Build payload for GridPlus SDK
    // This is simplified - a full implementation would need to build proper PSBT
    const payload = {
      prevOuts: msg.inputs.map(input => ({
        txHash: (input as any).txid,
        value: parseInt(input.amount || "0"),
        index: input.vout,
      })),
      recipient: msg.outputs[0]?.address || "",
      value: parseInt(msg.outputs[0]?.amount || "0"),
      fee: 0, // Calculate from inputs/outputs
      changePath: msg.outputs.find(o => o.isChange)?.addressNList,
    };

    try {
      const signData = await signFn(payload as any);

      if (!signData || !signData.tx) {
        throw new Error("No signed transaction returned from device");
      }

      return {
        signatures: [signData.sig?.toString("hex") || ""],
        serializedTx: signData.tx.toString("hex"),
      };
    } catch (error) {
      throw error;
    }
  }

  public async btcSignMessage(msg: core.BTCSignMessage): Promise<core.BTCSignedMessage | null> {
    throw new Error("GridPlus BTC message signing not yet implemented");
  }

  public async btcVerifyMessage(msg: core.BTCVerifyMessage): Promise<boolean | null> {
    throw new Error("GridPlus BTC message verification not yet implemented");
  }

  public btcNextAccountPath(msg: core.BTCAccountPath): core.BTCAccountPath | undefined {
    const newAddressNList = [...msg.addressNList];
    newAddressNList[2] += 1;

    return {
      ...msg,
      addressNList: newAddressNList,
    };
  }

  private scriptTypeToPurpose(scriptType: core.BTCInputScriptType): number {
    switch (scriptType) {
      case core.BTCInputScriptType.SpendAddress:
        return 44;
      case core.BTCInputScriptType.SpendP2SHWitness:
        return 49;
      case core.BTCInputScriptType.SpendWitness:
        return 84;
      default:
        return 44;
    }
  }

}