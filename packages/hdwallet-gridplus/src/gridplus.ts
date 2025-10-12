import type { StdTx } from "@cosmjs/amino";
import type { DirectSignResponse, OfflineDirectSigner } from "@cosmjs/proto-signing";
import type { SignerData } from "@cosmjs/stargate";
import { pointCompress, recover } from "@bitcoinerlab/secp256k1";
import type { SignDoc } from "cosmjs-types/cosmos/tx/v1beta1/tx";
import Common from "@ethereumjs/common";
import { FeeMarketEIP1559Transaction, Transaction } from "@ethereumjs/tx";
import * as core from "@shapeshiftoss/hdwallet-core";
import * as bech32 from "bech32";
import * as bchAddr from "bchaddrjs";
import bs58 from "bs58";
import { PublicKey } from "@solana/web3.js";
import { decode as bs58Decode, encode as bs58Encode } from "bs58check";
import CryptoJS from "crypto-js";
import {
  Client,
  Constants,
  Utils,
} from "gridplus-sdk";
import * as bitcoin from "@shapeshiftoss/bitcoinjs-lib";
import { SignTypedDataVersion, TypedDataUtils } from "@metamask/eth-sig-util";
import isObject from "lodash/isObject";
import PLazy from "p-lazy";
import { encode } from "rlp";

const protoTxBuilder = PLazy.from(() => import("@shapeshiftoss/proto-tx-builder"));
const cosmJsProtoSigning = PLazy.from(() => import("@cosmjs/proto-signing"));

import { GridPlusTransport } from "./transport";
import { UTXO_NETWORK_PARAMS } from "./constants";
import { convertXpubVersion, scriptTypeToAccountType, deriveAddressFromPubkey } from "./utils";

export function isGridPlus(wallet: core.HDWallet): wallet is GridPlusHDWallet {
  return isObject(wallet) && (wallet as any)._isGridPlus;
}

export class GridPlusHDWallet implements core.HDWallet, core.ETHWallet, core.SolanaWallet, core.BTCWallet, core.CosmosWallet, core.ThorchainWallet, core.MayachainWallet {
  readonly _isGridPlus = true;
  private activeWalletId?: string;

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
  readonly _supportsCosmos = true;
  readonly _supportsCosmosInfo = true;
  readonly _supportsThorchain = true;
  readonly _supportsThorchainInfo = true;
  readonly _supportsMayachain = true;
  readonly _supportsMayachainInfo = true;

  info: GridPlusWalletInfo & core.HDWalletInfo;
  transport: GridPlusTransport;
  client?: Client;

  constructor(transport: GridPlusTransport) {
    this.transport = transport;
    this.info = new GridPlusWalletInfo();
  }

  public setActiveWalletId(walletId: string): void {
    this.activeWalletId = walletId;
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
  }

  public async sendPassphrase(): Promise<void> {
  }

  public async sendCharacter(): Promise<void> {
  }

  public async sendWord(): Promise<void> {
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
    return this.activeWalletId || await this.transport.getDeviceID();
  }

  public async getPublicKeys(msg: Array<core.GetPublicKey>): Promise<Array<core.PublicKey | null>> {
    if (!this.client) {
      throw new Error("Device not connected");
    }

    const publicKeys: Array<core.PublicKey | null> = [];

    for (const getPublicKey of msg) {
      const { addressNList, curve, coin, scriptType } = getPublicKey;

      try {
        let flag: number;

        // Determine the appropriate flag based on curve type
        if (curve === "secp256k1") {
          // For UTXO chains (Bitcoin, Dogecoin), we need the xpub
          flag = Constants.GET_ADDR_FLAGS.SECP256K1_XPUB;
        } else if (curve === "ed25519") {
          // For Solana/ed25519 chains, we need the public key
          flag = Constants.GET_ADDR_FLAGS.ED25519_PUB;
        } else {
          throw new Error(`Unsupported curve: ${curve}`);
        }

        const addresses = await this.client!.getAddresses({
          startPath: addressNList,
          n: 1,
          flag,
        });

        if (!addresses || addresses.length === 0) {
          throw new Error("No public key returned from device");
        }

        // addresses[0] contains either xpub string (for SECP256K1_XPUB) or pubkey hex (for ED25519_PUB)
        let xpub = typeof addresses[0] === "string" ? addresses[0] : Buffer.from(addresses[0]).toString("hex");

        // Convert xpub format for Dogecoin/Litecoin (GridPlus returns Bitcoin xpub format)
        if (coin && curve === "secp256k1") {
          const accountType = scriptTypeToAccountType(scriptType);
          xpub = convertXpubVersion(xpub, accountType, coin);
        }

        publicKeys.push({ xpub });
      } catch (error) {
        publicKeys.push(null);
      }
    }

    return publicKeys;
  }

  public getSessionId(): string | undefined {
    return this.transport.getSessionId();
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
    if (!this.client) {
      throw new Error("Device not connected");
    }

    // Additional validation
    if (typeof this.client.getAddresses !== 'function') {
      throw new Error("GridPlus client does not have getAddresses method");
    }

    return this.performAddressRequest(msg);
  }

  private async performAddressRequest(msg: core.ETHGetAddress): Promise<core.Address | null> {
    try {
      // Extract address index from EVM path: m/44'/60'/0'/0/X
      // addressNList = [44', 60', 0', 0, X]
      const addressIndex = msg.addressNList[4] || 0;
      const startPath = [...msg.addressNList.slice(0, 4), addressIndex];

      // Fetch only the requested address using client instance
      const addresses = await this.client!.getAddresses({
        startPath,
        n: 1,
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

      // Ensure address starts with 0x for EVM
      if (!address.startsWith('0x')) {
        address = '0x' + address;
      }

      // Validate Ethereum address format (should be 42 chars with 0x prefix)
      if (address.length !== 42) {
        throw new Error(`Invalid Ethereum address length: ${address}`);
      }

      // core.Address for ETH is just a string type `0x${string}`
      return address.toLowerCase() as core.Address;
    } catch (error) {
      throw error;
    }
  }


  // Solana Wallet Methods
  public solanaGetAccountPaths(msg: core.SolanaGetAccountPaths): Array<core.SolanaAccountPath> {
    // Solana uses 4-level derivation path: m/44'/501'/account'/0'
    // All indices must be hardened for ED25519 (matches SDK's SOLANA_DERIVATION)
    return [{ addressNList: [0x80000000 + 44, 0x80000000 + 501, 0x80000000 + msg.accountIdx, 0x80000000 + 0] }];
  }

  public async solanaGetAddress(msg: core.SolanaGetAddress): Promise<string | null> {
    // CRITICAL FIX: Solana ED25519 requires ALL indices to be hardened
    // The chain adapter might send unhardened indices, so we need to fix them
    const correctedPath = msg.addressNList.map((idx, i) => {
      if (idx >= 0x80000000) {
        return idx; // Already hardened
      } else {
        return idx + 0x80000000;
      }
    });

    // Verify all indices are now hardened
    const allHardened = correctedPath.every(idx => idx >= 0x80000000);

    if (!allHardened) {
      throw new Error("Failed to harden all Solana path indices for ED25519");
    }

    if (!this.client) {
      throw new Error("Device not connected");
    }

    // Check firmware version supports ED25519
    const fwVersion = this.client.getFwVersion();

    if (fwVersion.major === 0 && fwVersion.minor < 14) {
      throw new Error(`Solana requires firmware >= 0.14.0, current: ${fwVersion.major}.${fwVersion.minor}.${fwVersion.fix}`);
    }

    try {
      // Use client instance directly instead of global SDK functions
      // This ensures we always query the device with the current client state
      const addresses = await this.client!.getAddresses({
        startPath: correctedPath,
        n: 1,
        flag: Constants.GET_ADDR_FLAGS.ED25519_PUB,
      });

      if (!addresses || addresses.length === 0) {
        throw new Error("No address returned from device");
      }

      // The result is the ED25519 public key
      const pubkeyBuffer = Buffer.isBuffer(addresses[0])
        ? addresses[0]
        : Buffer.from(addresses[0], "hex");

      // Encode as base58 for Solana address format
      const address = bs58.encode(pubkeyBuffer);

      return address;
    } catch (error) {
      throw error;
    }
  }

  public async solanaSignTx(msg: core.SolanaSignTx): Promise<core.SolanaSignedTx | null> {
    if (!this.client) {
      throw new Error("Device not connected");
    }

    // CRITICAL FIX: Solana requires ALL 4 path indices to be hardened for ED25519
    // The chain adapter sometimes sends m/44'/501'/0'/0 (last index unhardened)
    // but GridPlus SDK requires m/44'/501'/0'/0' (all hardened)
    // Fix any unhardened indices by hardening them
    const correctedPath = msg.addressNList.map(idx => {
      // If index is already hardened (>= 0x80000000), keep it
      if (idx >= 0x80000000) return idx;
      // Otherwise, harden it by adding 0x80000000
      return idx + 0x80000000;
    });

    // Verify all indices are now hardened
    const allHardened = correctedPath.every(idx => idx >= 0x80000000);
    if (!allHardened) {
      throw new Error("Failed to harden all Solana path indices - this should never happen");
    }

    try {
      const address = await this.solanaGetAddress({
        addressNList: correctedPath,
        showDisplay: false,
      });

      if (!address) throw new Error("Failed to get Solana address");

      const transaction = core.solanaBuildTransaction(msg, address);
      // Sign the message portion of the transaction
      // GridPlus SDK expects the message bytes, not the full serialized transaction
      const messageBytes = transaction.message.serialize();

      // Sign directly using client.sign() instead of signSolanaTx wrapper
      // This bypasses the SDK's hardcoded SOLANA_DERIVATION and gives us full control
      // Use the corrected path with all indices hardened
      const signingRequest = {
        data: {
          signerPath: correctedPath,
          curveType: Constants.SIGNING.CURVES.ED25519,
          hashType: Constants.SIGNING.HASHES.NONE,
          encodingType: Constants.SIGNING.ENCODINGS.SOLANA,
          payload: Buffer.from(messageBytes),
        }
      };

      const signData = await this.client.sign(signingRequest);

      if (!signData || !signData.sig) {
        throw new Error("No signature returned from device");
      }

      // ED25519 signatures return {r: Buffer(32), s: Buffer(32)}
      // Combine into 64-byte signature for Solana
      const signature = Buffer.concat([signData.sig.r, signData.sig.s]);

      // CRITICAL FIX: Add the signature to the transaction before serializing
      // This attaches the signature to the transaction object so the full signed transaction
      // is returned, not just the message
      transaction.addSignature(new PublicKey(address), signature);

      // Now serialize the complete signed transaction (message + signatures)
      const serializedTx = transaction.serialize();

      return {
        serialized: Buffer.from(serializedTx).toString("base64"),
        signatures: transaction.signatures.map((sig) => Buffer.from(sig).toString("base64")),
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

      // Check firmware supports EIP-712
      const fwConstants = this.client.getFwConstants();
      if (!fwConstants.eip712Supported) {
        throw new Error("EIP-712 signing not supported by firmware version");
      }

      // Get the address for this path
      const addressResult = await this.ethGetAddress({
        addressNList: msg.addressNList,
        showDisplay: false,
      });

      // Use GridPlus SDK's built-in EIP-712 support with protocol parameter
      // Pass the FULL typed data structure (not pre-hashed)
      // The SDK/firmware will handle hashing and signing internally
      const signingOptions = {
        currency: 'ETH_MSG' as any,  // ETH_MSG currency for message signing
        data: {
          protocol: 'eip712' as any,  // Specify EIP-712 protocol
          payload: msg.typedData,      // Pass full typed data structure
          signerPath: msg.addressNList,
        }
      };

      // TODO: remove highlander-based-development
      // @ts-ignore - GridPlus SDK external typing
      const signedResult = await this.client.sign(signingOptions);

      if (!signedResult?.sig) {
        throw new Error("No signature returned from device");
      }

      const { r, s, v } = signedResult.sig;

      // Format signature components - r and s come as hex strings from the device
      // DO NOT double-encode them!
      let rHex: string;
      let sHex: string;

      if (Buffer.isBuffer(r)) {
        rHex = "0x" + r.toString('hex');
      } else if (typeof r === 'string') {
        // r is a string (TypeScript knows this now)
        if ((r as string).startsWith('0x')) {
          rHex = r; // Already hex with 0x prefix
        } else {
          rHex = "0x" + r; // Hex without 0x prefix
        }
      } else {
        throw new Error(`Unexpected r format: ${typeof r}`);
      }

      if (Buffer.isBuffer(s)) {
        sHex = "0x" + s.toString('hex');
      } else if (typeof s === 'string') {
        // s is a string (TypeScript knows this now)
        if ((s as string).startsWith('0x')) {
          sHex = s; // Already hex with 0x prefix
        } else {
          sHex = "0x" + s; // Hex without 0x prefix
        }
      } else {
        throw new Error(`Unexpected s format: ${typeof s}`);
      }

      // v is returned by device for EIP-712
      const vBuf = Buffer.isBuffer(v) ? v : (typeof v === 'number' ? Buffer.from([v]) : Buffer.from(v));
      const vValue = vBuf.readUInt8(0);
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
    try {
      if (!this.client) {
        throw new Error("Device not connected");
      }

      // Check if client has the sign method
      if (typeof this.client.sign !== 'function') {
        throw new Error("GridPlus client missing required sign method");
      }

      // Get the address for this path
      const addressResult = await this.ethGetAddress({
        addressNList: msg.addressNList,
        showDisplay: false,
      });

      // For personal_sign, the message needs to be hex-encoded
      // If it's not already hex, convert it
      let hexMessage: string;
      if (msg.message.startsWith('0x')) {
        hexMessage = msg.message;
      } else {
        // Convert string to hex
        const buffer = Buffer.from(msg.message, 'utf8');
        hexMessage = '0x' + buffer.toString('hex');
      }

      // Use GridPlus SDK's ETH_MSG currency with signPersonal protocol
      // This handles the Ethereum message prefix automatically
      const signingOptions = {
        currency: 'ETH_MSG' as any,  // ETH_MSG currency for message signing
        data: {
          protocol: 'signPersonal' as any,  // Use signPersonal protocol for personal_sign
          payload: hexMessage,               // Hex-encoded message
          signerPath: msg.addressNList,
        }
      };

      // TODO: remove highlander-based-development
      // @ts-ignore - GridPlus SDK external typing
      const signedResult = await this.client.sign(signingOptions);

      if (!signedResult?.sig) {
        throw new Error("No signature returned from device");
      }

      const { r, s, v } = signedResult.sig;

      // Format signature components - same as EIP-712
      let rHex: string;
      let sHex: string;

      if (Buffer.isBuffer(r)) {
        rHex = "0x" + r.toString('hex');
      } else if (typeof r === 'string') {
        if ((r as string).startsWith('0x')) {
          rHex = r;
        } else {
          rHex = "0x" + r;
        }
      } else {
        throw new Error(`Unexpected r format: ${typeof r}`);
      }

      if (Buffer.isBuffer(s)) {
        sHex = "0x" + s.toString('hex');
      } else if (typeof s === 'string') {
        if ((s as string).startsWith('0x')) {
          sHex = s;
        } else {
          sHex = "0x" + s;
        }
      } else {
        throw new Error(`Unexpected s format: ${typeof s}`);
      }

      // v is returned by device for personal_sign
      const vBuf = Buffer.isBuffer(v) ? v : (typeof v === 'number' ? Buffer.from([v]) : Buffer.from(v));
      const vValue = vBuf.readUInt8(0);
      const vHex = "0x" + vValue.toString(16);

      const signature = rHex + sHex.slice(2) + vHex.slice(2);

      return {
        address: addressResult as string,
        signature: signature,
      };
    } catch (error) {
      throw error;
    }
  }

  // TODO: remove highlander-based-development
  public async ethVerifyMessage(msg: core.ETHVerifyMessage): Promise<boolean> {
    throw new Error("GridPlus ethVerifyMessage not implemented yet");
  }

  // Bitcoin Wallet Methods
  public async btcSupportsCoin(coin: core.Coin): Promise<boolean> {
    // Support Bitcoin, Dogecoin, Litecoin
    return ["Bitcoin", "Dogecoin", "Litecoin", "Testnet"].includes(coin);
  }

  public async btcSupportsScriptType(coin: core.Coin, scriptType?: core.BTCInputScriptType): Promise<boolean> {
    const supported = {
      Bitcoin: [
        core.BTCInputScriptType.SpendAddress,      // p2pkh
        core.BTCInputScriptType.SpendP2SHWitness,  // p2sh-p2wpkh
        core.BTCInputScriptType.SpendWitness,      // p2wpkh
      ],
      Dogecoin: [core.BTCInputScriptType.SpendAddress],  // p2pkh only
      Litecoin: [
        core.BTCInputScriptType.SpendAddress,      // p2pkh
        core.BTCInputScriptType.SpendP2SHWitness,  // p2sh-p2wpkh
        core.BTCInputScriptType.SpendWitness,      // p2wpkh
      ],
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
    if (!slip44) throw new Error(`Unsupported coin: ${msg.coin}`);

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
    // Get compressed public key from device (works for all UTXO coins)
    // Using SECP256K1_PUB flag bypasses Lattice's address formatting,
    // which only supports Bitcoin/Ethereum/Solana
    const pubkeys = await this.client!.getAddresses({
      startPath: msg.addressNList,
      n: 1,
      flag: Constants.GET_ADDR_FLAGS.SECP256K1_PUB,
    });

    if (!pubkeys || !pubkeys.length) {
      throw new Error("No public key returned from device");
    }

    // pubkeys[0] may be uncompressed (65 bytes) or compressed (33 bytes)
    const pubkeyBuffer = Buffer.isBuffer(pubkeys[0])
      ? pubkeys[0]
      : Buffer.from(pubkeys[0], "hex");

    // Compress if needed (65 bytes = uncompressed, 33 bytes = already compressed)
    const pubkeyHex = pubkeyBuffer.length === 65
      ? Buffer.from(pointCompress(pubkeyBuffer, true)).toString("hex")
      : pubkeyBuffer.toString("hex");

    // Derive address client-side using the coin's network parameters
    const scriptType = msg.scriptType || core.BTCInputScriptType.SpendAddress;
    const address = deriveAddressFromPubkey(pubkeyHex, msg.coin, scriptType);

    return address;
  }

  public async btcSignTx(msg: core.BTCSignTx): Promise<core.BTCSignedTx | null> {
    if (!this.client) {
      throw new Error("Device not connected");
    }

    // All UTXO coins (Bitcoin, Dogecoin, Litecoin, BitcoinCash) use Bitcoin-compatible transaction formats.
    // The 'BTC' currency parameter is just SDK routing - the device signs Bitcoin-formatted transactions.
    // Address derivation already handles all coins via client-side derivation with proper network parameters.

    // Calculate fee: total inputs - total outputs
    const totalInputValue = msg.inputs.reduce((sum, input) => sum + parseInt(input.amount || "0"), 0);
    const totalOutputValue = msg.outputs.reduce((sum, output) => sum + parseInt(output.amount || "0"), 0);
    const fee = totalInputValue - totalOutputValue;

    // Find change output and its path
    const changeOutput = msg.outputs.find(o => o.isChange);
    const changePath = changeOutput?.addressNList;

    // Build base payload for GridPlus SDK
    const payload: any = {
      prevOuts: msg.inputs.map(input => ({
        txHash: (input as any).txid,
        value: parseInt(input.amount || "0"),
        index: input.vout,
        signerPath: input.addressNList,
      })),
      recipient: msg.outputs[0]?.address || "",
      value: parseInt(msg.outputs[0]?.amount || "0"),
      fee: fee,
    };

    // SDK requires changePath even when there's no change output
    // Use actual change path if available, otherwise use dummy path (first change address)
    // The dummy path satisfies SDK validation but won't be used since there's no change output
    const finalChangePath = changePath && changePath.length === 5
      ? changePath
      : [
          msg.inputs[0].addressNList[0], // purpose (44', 49', or 84')
          msg.inputs[0].addressNList[1], // coin type
          msg.inputs[0].addressNList[2], // account
          1,                               // change chain (1 = change, 0 = receive)
          0                                // address index
        ];

    payload.changePath = finalChangePath;


    try {
      if (msg.coin === "Bitcoin" || msg.coin === "Testnet") {
        const signData = await this.client.sign({
          currency: 'BTC' as any,
          data: payload,
        });

        if (!signData || !signData.tx) {
          throw new Error("No signed transaction returned from device");
        }

        const signatures = signData.sigs ? signData.sigs.map((s: Buffer) => s.toString("hex")) : [];

        return {
          signatures,
          serializedTx: signData.tx,
        };
      } else {

        const network = UTXO_NETWORK_PARAMS[msg.coin];
        if (!network) {
          throw new Error(`Unsupported UTXO coin: ${msg.coin}`);
        }

        const tx = new bitcoin.Transaction();

        for (const input of msg.inputs) {
          const txHashBuffer = Buffer.from((input as any).txid, 'hex').reverse();
          tx.addInput(txHashBuffer, input.vout);
        }

        for (let outputIdx = 0; outputIdx < msg.outputs.length; outputIdx++) {
          const output = msg.outputs[outputIdx];
          let address: string;


          if (output.address) {
            address = output.address;
          } else if (output.addressNList) {

            // Derive address for change output
            const pubkey = await this.client!.getAddresses({
              startPath: output.addressNList,
              n: 1,
              flag: Constants.GET_ADDR_FLAGS.SECP256K1_PUB,
            });

            if (!pubkey || !pubkey.length) {
              throw new Error(`No public key for output`);
            }

            const pubkeyBuffer = Buffer.isBuffer(pubkey[0]) ? pubkey[0] : Buffer.from(pubkey[0], "hex");

            const pubkeyHex = pubkeyBuffer.length === 65
              ? Buffer.from(pointCompress(pubkeyBuffer, true)).toString("hex")
              : pubkeyBuffer.toString("hex");

            const scriptType = (output.scriptType as unknown as core.BTCInputScriptType) || core.BTCInputScriptType.SpendAddress;
            address = deriveAddressFromPubkey(pubkeyHex, msg.coin, scriptType);
          } else {
            throw new Error("Output must have either address or addressNList");
          }

          const { hash160, scriptPubKey } = (() => {
            if (address.startsWith('ltc1') || address.startsWith('bc1')) {
              const decoded = bech32.decode(address);
              const hash160 = Buffer.from(bech32.fromWords(decoded.words.slice(1)));

              const scriptPubKey = bitcoin.script.compile([
                bitcoin.opcodes.OP_0,
                hash160
              ]);
              return { hash160, scriptPubKey };
            }

            if (address.startsWith('bitcoincash:') || address.startsWith('q')) {
              const legacyAddress = bchAddr.toLegacyAddress(address);

              const decoded = bs58Decode(legacyAddress);

              const hash160 = decoded.slice(1);

              const scriptPubKey = bitcoin.script.compile([
                bitcoin.opcodes.OP_DUP,
                bitcoin.opcodes.OP_HASH160,
                hash160,
                bitcoin.opcodes.OP_EQUALVERIFY,
                bitcoin.opcodes.OP_CHECKSIG
              ]);
              return { hash160, scriptPubKey };
            }

            const decoded = bs58Decode(address);

            const hash160 = decoded.slice(1);

            const scriptPubKey = bitcoin.script.compile([
              bitcoin.opcodes.OP_DUP,
              bitcoin.opcodes.OP_HASH160,
              hash160,
              bitcoin.opcodes.OP_EQUALVERIFY,
              bitcoin.opcodes.OP_CHECKSIG
            ]);
            return { hash160, scriptPubKey };
          })();

          tx.addOutput(scriptPubKey, BigInt(output.amount));
        }

        // DEBUG: Log the initial transaction (BEFORE signing) that will be used to create signing preimages
        const initialTxHex = tx.toHex();
        for (let i = 0; i < tx.outs.length; i++) {
        }

        const signatures: string[] = [];

        for (let i = 0; i < msg.inputs.length; i++) {
          const input = msg.inputs[i];

          if (!input.hex) {
            throw new Error(`Input ${i} missing hex field (raw previous transaction)`);
          }

          const prevTx = bitcoin.Transaction.fromHex(input.hex);
          const prevOutput = prevTx.outs[input.vout];
          const scriptPubKey = prevOutput.script;

          // Detect input type from scriptPubKey
          // P2WPKH (SegWit): 0x00 0x14 <20-byte-hash>
          const isSegwit = scriptPubKey.length === 22 &&
                           scriptPubKey[0] === 0x00 &&
                           scriptPubKey[1] === 0x14;

          // Build signature preimage based on input type
          let signaturePreimage: Buffer;
          const hashType = msg.coin === 'BitcoinCash'
            ? bitcoin.Transaction.SIGHASH_ALL | 0x40  // SIGHASH_FORKID for BitcoinCash
            : bitcoin.Transaction.SIGHASH_ALL;

          // BitcoinCash requires BIP143 for both P2PKH and P2WPKH
          const useBIP143 = isSegwit || msg.coin === 'BitcoinCash';

          if (useBIP143) {
            // BIP143 signing (used for SegWit and BitcoinCash)
            if (isSegwit) {
            } else {
            }
            // bitcoinjs-lib's hashForWitnessV0 computes the full double-sha256 hash
            // We need the unhashed preimage, so we'll manually construct it

            // BIP143 preimage structure:
            // 1. nVersion (4 bytes)
            // 2. hashPrevouts (32 bytes)
            // 3. hashSequence (32 bytes)
            // 4. outpoint (36 bytes)
            // 5. scriptCode (variable)
            // 6. value (8 bytes)
            // 7. nSequence (4 bytes)
            // 8. hashOutputs (32 bytes)
            // 9. nLocktime (4 bytes)
            // 10. nHashType (4 bytes)

            const hashPrevouts = CryptoJS.SHA256(CryptoJS.SHA256(
              CryptoJS.lib.WordArray.create(Buffer.concat(
                msg.inputs.map(inp => Buffer.concat([
                  Buffer.from((inp as any).txid, 'hex').reverse(),
                  Buffer.from([inp.vout, 0, 0, 0])
                ]))
              ))
            ));

            const hashSequence = CryptoJS.SHA256(CryptoJS.SHA256(
              CryptoJS.lib.WordArray.create(Buffer.concat(
                msg.inputs.map(() => Buffer.from([0xff, 0xff, 0xff, 0xff]))
              ))
            ));

            const hashOutputs = CryptoJS.SHA256(CryptoJS.SHA256(
              CryptoJS.lib.WordArray.create(Buffer.concat(
                tx.outs.map(out => {
                  // Convert bigint to number for small UTXO values
                  const valueNum = typeof out.value === 'bigint' ? Number(out.value) : out.value;
                  const valueBuffer = Buffer.alloc(8);
                  valueBuffer.writeUInt32LE(valueNum & 0xffffffff, 0);
                  valueBuffer.writeUInt32LE(Math.floor(valueNum / 0x100000000), 4);
                  return Buffer.concat([
                    valueBuffer,
                    Buffer.from([out.script.length]),
                    out.script
                  ]);
                })
              ))
            ));

            // scriptCode depends on input type
            let scriptCode: Buffer;
            if (isSegwit) {
              // P2WPKH: Build scriptCode from hash extracted from witness program
              scriptCode = Buffer.from(bitcoin.script.compile([
                bitcoin.opcodes.OP_DUP,
                bitcoin.opcodes.OP_HASH160,
                scriptPubKey.slice(2), // Remove OP_0 and length byte to get hash
                bitcoin.opcodes.OP_EQUALVERIFY,
                bitcoin.opcodes.OP_CHECKSIG
              ]));
            } else {
              // P2PKH (BitcoinCash): scriptCode IS the scriptPubKey
              scriptCode = Buffer.from(scriptPubKey);
            }

            const value = parseInt(input.amount || "0");
            const valueBuffer = Buffer.alloc(8);
            valueBuffer.writeUInt32LE(value & 0xffffffff, 0);
            valueBuffer.writeUInt32LE(Math.floor(value / 0x100000000), 4);

            signaturePreimage = Buffer.concat([
              Buffer.from([tx.version, 0, 0, 0]),
              Buffer.from(hashPrevouts.toString(CryptoJS.enc.Hex), 'hex'),
              Buffer.from(hashSequence.toString(CryptoJS.enc.Hex), 'hex'),
              Buffer.from((input as any).txid, 'hex').reverse(),
              Buffer.from([input.vout, 0, 0, 0]),
              Buffer.from([scriptCode.length]),
              scriptCode,
              valueBuffer,
              Buffer.from([0xff, 0xff, 0xff, 0xff]), // sequence
              Buffer.from(hashOutputs.toString(CryptoJS.enc.Hex), 'hex'),
              Buffer.from([tx.locktime, 0, 0, 0]),
              Buffer.from([hashType, 0, 0, 0])
            ]);
          } else {
            // Legacy signing
            const txTmp = tx.clone();

            // Remove OP_CODESEPARATOR from scriptPubKey (Bitcoin standard)
            const decompiled = bitcoin.script.decompile(scriptPubKey);
            if (!decompiled) {
              throw new Error(`Failed to decompile scriptPubKey for input ${i}`);
            }
            const ourScript = bitcoin.script.compile(
              decompiled.filter(x => x !== bitcoin.opcodes.OP_CODESEPARATOR)
            );

            // For SIGHASH_ALL: blank all input scripts except the one being signed
            txTmp.ins.forEach((txInput, idx) => {
              txInput.script = idx === i ? ourScript : Buffer.alloc(0);
            });

            // Serialize transaction + append hashType (4 bytes)
            const txBuffer = txTmp.toBuffer();
            const hashTypeBuffer = Buffer.alloc(4);
            hashTypeBuffer.writeUInt32LE(hashType, 0);
            signaturePreimage = Buffer.concat([txBuffer, hashTypeBuffer]);
          }




          // Bitcoin/Dogecoin/Litecoin require double SHA256 for transaction signatures.
          // Strategy: Hash once ourselves, then let device hash again (SHA256 + SHA256 = double SHA256)
          // This avoids using hashType.NONE which causes "Invalid Request" errors.
          const hash1 = CryptoJS.SHA256(CryptoJS.lib.WordArray.create(signaturePreimage));
          const singleHashedBuffer = Buffer.from(hash1.toString(CryptoJS.enc.Hex), 'hex');

          const expectedDoubleHash = CryptoJS.SHA256(hash1);

          const signData = {
            data: {
              payload: singleHashedBuffer,
              curveType: Constants.SIGNING.CURVES.SECP256K1,
              hashType: Constants.SIGNING.HASHES.SHA256,  // Device will hash again → double SHA256
              encodingType: Constants.SIGNING.ENCODINGS.NONE,
              signerPath: input.addressNList,
            }
          };

          let signedResult;
          try {
            signedResult = await this.client.sign(signData);
          } catch (error) {
            throw new Error(`Device signing failed for input ${i}: ${(error as any).message}`);
          }

          if (!signedResult?.sig) {
            throw new Error(`No signature returned from device for input ${i}`);
          }

          const { r, s } = signedResult.sig;
          const rBuf = Buffer.isBuffer(r) ? r : Buffer.from(r);
          const sBuf = Buffer.isBuffer(s) ? s : Buffer.from(s);

          function encodeDerSignature(r: Buffer, s: Buffer, hashType: number): Buffer {
            function encodeDerInteger(x: Buffer): Buffer {
              if (x[0] & 0x80) {
                return Buffer.concat([Buffer.from([0x00]), x]);
              }
              return x;
            }

            const rEncoded = encodeDerInteger(r);
            const sEncoded = encodeDerInteger(s);

            const derSignature = Buffer.concat([
              Buffer.from([0x30]),
              Buffer.from([rEncoded.length + sEncoded.length + 4]),
              Buffer.from([0x02]),
              Buffer.from([rEncoded.length]),
              rEncoded,
              Buffer.from([0x02]),
              Buffer.from([sEncoded.length]),
              sEncoded,
              Buffer.from([hashType])
            ]);

            return derSignature;
          }

          // Use the same hashType that was used for the signature preimage
          const sigHashType = msg.coin === 'BitcoinCash'
            ? bitcoin.Transaction.SIGHASH_ALL | 0x40  // SIGHASH_FORKID
            : bitcoin.Transaction.SIGHASH_ALL;
          const derSig = encodeDerSignature(rBuf, sBuf, sigHashType);
          signatures.push(derSig.toString("hex"));
        }

        // Reconstruct a clean transaction from scratch with all signatures
        // This ensures proper scriptSig encoding using bitcoinjs-lib
        const finalTx = new bitcoin.Transaction();
        finalTx.version = tx.version;
        finalTx.locktime = tx.locktime;

        // Add inputs with proper scriptSigs
        for (let i = 0; i < msg.inputs.length; i++) {
          const input = msg.inputs[i];
          const txHashBuffer = Buffer.from((input as any).txid, 'hex').reverse();
          finalTx.addInput(txHashBuffer, input.vout);

          // Get the signature we collected earlier
          const derSig = Buffer.from(signatures[i], 'hex');

          // Get pubkey for this input
          const pubkey = await this.client!.getAddresses({
            startPath: input.addressNList,
            n: 1,
            flag: Constants.GET_ADDR_FLAGS.SECP256K1_PUB,
          });

          if (!pubkey || !pubkey.length) {
            throw new Error(`No public key for input ${i}`);
          }

          const pubkeyBuffer = Buffer.isBuffer(pubkey[0]) ? pubkey[0] : Buffer.from(pubkey[0], "hex");
          const compressedPubkey = pubkeyBuffer.length === 65
            ? Buffer.from(pointCompress(pubkeyBuffer, true))
            : pubkeyBuffer;

          // Detect input type to determine if we need SegWit or legacy encoding
          const prevTx = bitcoin.Transaction.fromHex(input.hex);
          const prevOutput = prevTx.outs[input.vout];
          const isSegwit = prevOutput.script.length === 22 &&
                           prevOutput.script[0] === 0x00 &&
                           prevOutput.script[1] === 0x14;

          if (isSegwit) {
            // SegWit: empty scriptSig, signature + pubkey in witness
            finalTx.ins[i].script = Buffer.alloc(0);
            finalTx.ins[i].witness = [derSig, compressedPubkey];
          } else {
            // Legacy: signature + pubkey in scriptSig
            const scriptSig = bitcoin.script.compile([
              derSig,
              compressedPubkey,
            ]);
            finalTx.ins[i].script = scriptSig;
          }
        }

        // Add outputs - handle both address and addressNList
        for (let outputIdx = 0; outputIdx < msg.outputs.length; outputIdx++) {
          const output = msg.outputs[outputIdx];
          let address: string;


          if (output.address) {
            // Output already has address
            address = output.address;
          } else if (output.addressNList) {

            // Derive address from addressNList (for change outputs)
            const pubkey = await this.client!.getAddresses({
              startPath: output.addressNList,
              n: 1,
              flag: Constants.GET_ADDR_FLAGS.SECP256K1_PUB,
            });

            if (!pubkey || !pubkey.length) {
              throw new Error(`No public key for output`);
            }

            const pubkeyBuffer = Buffer.isBuffer(pubkey[0]) ? pubkey[0] : Buffer.from(pubkey[0], "hex");

            const pubkeyHex = pubkeyBuffer.length === 65
              ? Buffer.from(pointCompress(pubkeyBuffer, true)).toString("hex")
              : pubkeyBuffer.toString("hex");

            const scriptType = (output.scriptType as unknown as core.BTCInputScriptType) || core.BTCInputScriptType.SpendAddress;
            address = deriveAddressFromPubkey(pubkeyHex, msg.coin, scriptType);
          } else {
            throw new Error("Output must have either address or addressNList");
          }

          const { hash160, scriptPubKey } = (() => {
            if (address.startsWith('ltc1') || address.startsWith('bc1')) {
              const decoded = bech32.decode(address);
              const hash160 = Buffer.from(bech32.fromWords(decoded.words.slice(1)));

              const scriptPubKey = bitcoin.script.compile([
                bitcoin.opcodes.OP_0,
                hash160
              ]);
              return { hash160, scriptPubKey };
            }

            if (address.startsWith('bitcoincash:') || address.startsWith('q')) {
              const legacyAddress = bchAddr.toLegacyAddress(address);

              const decoded = bs58Decode(legacyAddress);

              const hash160 = decoded.slice(1);

              const scriptPubKey = bitcoin.script.compile([
                bitcoin.opcodes.OP_DUP,
                bitcoin.opcodes.OP_HASH160,
                hash160,
                bitcoin.opcodes.OP_EQUALVERIFY,
                bitcoin.opcodes.OP_CHECKSIG
              ]);
              return { hash160, scriptPubKey };
            }

            const decoded = bs58Decode(address);

            const hash160 = decoded.slice(1);

            const scriptPubKey = bitcoin.script.compile([
              bitcoin.opcodes.OP_DUP,
              bitcoin.opcodes.OP_HASH160,
              hash160,
              bitcoin.opcodes.OP_EQUALVERIFY,
              bitcoin.opcodes.OP_CHECKSIG
            ]);
            return { hash160, scriptPubKey };
          })();

          finalTx.addOutput(scriptPubKey, BigInt(output.amount));
        }

        const serializedTx = finalTx.toHex();

        // DEBUG LOGGING - comprehensive transaction details
        for (let i = 0; i < finalTx.ins.length; i++) {
        }
        for (let i = 0; i < finalTx.outs.length; i++) {
        }

        // COMPARISON: Compare initial vs final transaction outputs (excluding signatures)

        let outputsMismatch = false;
        for (let i = 0; i < Math.min(tx.outs.length, finalTx.outs.length); i++) {
          const initialValue = tx.outs[i].value.toString();
          const finalValue = finalTx.outs[i].value.toString();
          const initialScript = Buffer.from(tx.outs[i].script).toString('hex');
          const finalScript = Buffer.from(finalTx.outs[i].script).toString('hex');

          if (initialValue !== finalValue) {
            outputsMismatch = true;
          }
          if (initialScript !== finalScript) {
            outputsMismatch = true;
          }
        }

        if (!outputsMismatch) {
        } else {
        }


        return {
          signatures,
          serializedTx,
        };
      }
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

  // ============ Cosmos Support ============

  private bech32ify(address: ArrayLike<number>, prefix: string): string {
    const words = bech32.toWords(address);
    return bech32.encode(prefix, words);
  }

  private createCosmosAddress(publicKey: string, prefix: string): string {
    const message = CryptoJS.SHA256(CryptoJS.enc.Hex.parse(publicKey));
    const hash = CryptoJS.RIPEMD160(message as any).toString();
    const address = Buffer.from(hash, `hex`);
    return this.bech32ify(address, prefix);
  }

  public async cosmosGetAddress(msg: core.CosmosGetAddress): Promise<string | null> {
    if (!this.client) {
      throw new Error("Device not connected");
    }

    try {
      // Get secp256k1 pubkey using GridPlus client instance
      // Use FULL path - Cosmos uses standard BIP44: m/44'/118'/0'/0/0 (5 levels)
      const addresses = await this.client!.getAddresses({
        startPath: msg.addressNList,
        n: 1,
        flag: Constants.GET_ADDR_FLAGS.SECP256K1_PUB,
      });

      if (!addresses || addresses.length === 0) {
        throw new Error("No address returned from device");
      }

      // GridPlus SDK returns uncompressed 65-byte pubkeys, but Cosmos needs compressed 33-byte pubkeys
      const pubkeyBuffer = Buffer.isBuffer(addresses[0]) ? addresses[0] : Buffer.from(addresses[0], "hex");
      const compressedPubkey = pointCompress(pubkeyBuffer, true);
      const compressedHex = Buffer.from(compressedPubkey).toString("hex");
      const cosmosAddress = this.createCosmosAddress(compressedHex, "cosmos");

      return cosmosAddress;
    } catch (error) {
      throw error;
    }
  }

  public async cosmosSignTx(msg: core.CosmosSignTx): Promise<core.CosmosSignedTx | null> {
    if (!this.client) {
      throw new Error("Device not connected");
    }

    try {
      // Get the address for this path
      const address = await this.cosmosGetAddress({ addressNList: msg.addressNList });
      if (!address) throw new Error("Failed to get Cosmos address");

      // Get the public key using client instance
      const pubkeys = await this.client!.getAddresses({
        startPath: msg.addressNList,
        n: 1,
        flag: Constants.GET_ADDR_FLAGS.SECP256K1_PUB,
      });

      if (!pubkeys || pubkeys.length === 0) {
        throw new Error("No public key returned from device");
      }

      // GridPlus SDK returns uncompressed 65-byte pubkeys, but Cosmos needs compressed 33-byte pubkeys
      const pubkeyBuffer = Buffer.isBuffer(pubkeys[0]) ? pubkeys[0] : Buffer.from(pubkeys[0], "hex");
      const compressedPubkey = pointCompress(pubkeyBuffer, true);
      const pubkey = Buffer.from(compressedPubkey);

      // Capture client reference for use in closure
      const client = this.client;

      // Create a signer adapter for GridPlus with Direct signing (Proto)
      const signer: OfflineDirectSigner = {
        getAccounts: async () => [{
          address,
          pubkey,
          algo: "secp256k1" as const,
        }],
        signDirect: async (signerAddress: string, signDoc: SignDoc): Promise<DirectSignResponse> => {
          if (signerAddress !== address) {
            throw new Error("Signer address mismatch");
          }

          // Use CosmJS to create the sign bytes from the SignDoc
          const signBytes = (await cosmJsProtoSigning).makeSignBytes(signDoc);

          // Sign using GridPlus SDK general signing
          // Pass unhashed signBytes and let device hash with SHA256
          const signData = {
            data: {
              payload: signBytes,
              curveType: Constants.SIGNING.CURVES.SECP256K1,
              hashType: Constants.SIGNING.HASHES.SHA256,
              encodingType: Constants.SIGNING.ENCODINGS.NONE,
              signerPath: msg.addressNList,
            }
          };

          const signedResult = await client.sign(signData);

          if (!signedResult?.sig) {
            throw new Error("No signature returned from device");
          }

          const { r, s } = signedResult.sig;
          const rHex = Buffer.isBuffer(r) ? r : Buffer.from(r);
          const sHex = Buffer.isBuffer(s) ? s : Buffer.from(s);

          // Combine r and s for signature
          const signature = Buffer.concat([rHex, sHex]);

          return {
            signed: signDoc,
            signature: {
              pub_key: {
                type: "tendermint/PubKeySecp256k1",
                value: pubkey.toString("base64"),
              },
              signature: signature.toString("base64"),
            },
          };
        },
      };

      const signerData: SignerData = {
        sequence: Number(msg.sequence),
        accountNumber: Number(msg.account_number),
        chainId: msg.chain_id,
      };

      return (await protoTxBuilder).sign(address, msg.tx as StdTx, signer, signerData, "cosmos");
    } catch (error) {
      throw error;
    }
  }

  public cosmosGetAccountPaths(msg: core.CosmosGetAccountPaths): Array<core.CosmosAccountPath> {
    const slip44 = core.slip44ByCoin("Atom");
    return [
      {
        addressNList: [0x80000000 + 44, 0x80000000 + slip44, 0x80000000 + msg.accountIdx, 0, 0],
      },
    ];
  }

  public cosmosNextAccountPath(msg: core.CosmosAccountPath): core.CosmosAccountPath | undefined {
    const newAddressNList = [...msg.addressNList];
    newAddressNList[2] += 1;
    return {
      addressNList: newAddressNList,
    };
  }

  // ============ THORChain Support ============

  public async thorchainGetAddress(msg: core.ThorchainGetAddress): Promise<string | null> {
    if (!this.client) {
      throw new Error("Device not connected");
    }

    const prefix = msg.testnet ? "tthor" : "thor";

    try {
      // Get secp256k1 pubkey using GridPlus client instance
      // Use FULL path - THORChain uses standard BIP44: m/44'/931'/0'/0/0 (5 levels)
      const addresses = await this.client!.getAddresses({
        startPath: msg.addressNList,
        n: 1,
        flag: Constants.GET_ADDR_FLAGS.SECP256K1_PUB,
      });

      if (!addresses || addresses.length === 0) {
        throw new Error("No address returned from device");
      }

      // GridPlus SDK returns uncompressed 65-byte pubkeys, but THORChain needs compressed 33-byte pubkeys
      const pubkeyBuffer = Buffer.isBuffer(addresses[0]) ? addresses[0] : Buffer.from(addresses[0], "hex");
      const compressedPubkey = pointCompress(pubkeyBuffer, true);
      const compressedHex = Buffer.from(compressedPubkey).toString("hex");
      const thorAddress = this.createCosmosAddress(compressedHex, prefix);

      return thorAddress;
    } catch (error) {
      throw error;
    }
  }

  public async thorchainSignTx(msg: core.ThorchainSignTx): Promise<core.ThorchainSignedTx | null> {
    if (!this.client) {
      throw new Error("Device not connected");
    }

    try {
      // Get the address for this path
      const address = await this.thorchainGetAddress({ addressNList: msg.addressNList, testnet: msg.testnet });
      if (!address) throw new Error("Failed to get THORChain address");

      // Get the public key using client instance
      const pubkeys = await this.client!.getAddresses({
        startPath: msg.addressNList,
        n: 1,
        flag: Constants.GET_ADDR_FLAGS.SECP256K1_PUB,
      });

      if (!pubkeys || pubkeys.length === 0) {
        throw new Error("No public key returned from device");
      }

      // GridPlus SDK returns uncompressed 65-byte pubkeys, but THORChain needs compressed 33-byte pubkeys
      const pubkeyBuffer = Buffer.isBuffer(pubkeys[0]) ? pubkeys[0] : Buffer.from(pubkeys[0], "hex");
      const compressedPubkey = pointCompress(pubkeyBuffer, true);
      const pubkey = Buffer.from(compressedPubkey);

      // Capture client reference for use in closure
      const client = this.client;

      // Create a signer adapter for GridPlus with Direct signing (Proto)
      const signer: OfflineDirectSigner = {
        getAccounts: async () => [{
          address,
          pubkey,
          algo: "secp256k1" as const,
        }],
        signDirect: async (signerAddress: string, signDoc: SignDoc): Promise<DirectSignResponse> => {
          if (signerAddress !== address) {
            throw new Error("Signer address mismatch");
          }

          // Use CosmJS to create the sign bytes from the SignDoc
          const signBytes = (await cosmJsProtoSigning).makeSignBytes(signDoc);

          // Sign using GridPlus SDK general signing
          // Pass unhashed signBytes and let device hash with SHA256
          const signData = {
            data: {
              payload: signBytes,
              curveType: Constants.SIGNING.CURVES.SECP256K1,
              hashType: Constants.SIGNING.HASHES.SHA256,
              encodingType: Constants.SIGNING.ENCODINGS.NONE,
              signerPath: msg.addressNList,
            }
          };

          const signedResult = await client.sign(signData);

          if (!signedResult?.sig) {
            throw new Error("No signature returned from device");
          }

          const { r, s } = signedResult.sig;
          const rHex = Buffer.isBuffer(r) ? r : Buffer.from(r);
          const sHex = Buffer.isBuffer(s) ? s : Buffer.from(s);

          // Combine r and s for signature
          const signature = Buffer.concat([rHex, sHex]);

          return {
            signed: signDoc,
            signature: {
              pub_key: {
                type: "tendermint/PubKeySecp256k1",
                value: pubkey.toString("base64"),
              },
              signature: signature.toString("base64"),
            },
          };
        },
      };

      const signerData: SignerData = {
        sequence: Number(msg.sequence),
        accountNumber: Number(msg.account_number),
        chainId: msg.chain_id,
      };

      return (await protoTxBuilder).sign(address, msg.tx as StdTx, signer, signerData, "thorchain");
    } catch (error) {
      throw error;
    }
  }

  public thorchainGetAccountPaths(msg: core.ThorchainGetAccountPaths): Array<core.ThorchainAccountPath> {
    const slip44 = core.slip44ByCoin("Rune");
    return [
      {
        addressNList: [0x80000000 + 44, 0x80000000 + slip44, 0x80000000 + msg.accountIdx, 0, 0],
      },
    ];
  }

  public thorchainNextAccountPath(msg: core.ThorchainAccountPath): core.ThorchainAccountPath | undefined {
    const newAddressNList = [...msg.addressNList];
    newAddressNList[2] += 1;
    return {
      addressNList: newAddressNList,
    };
  }

  // ============ MAYAchain Support ============

  public async mayachainGetAddress(msg: core.MayachainGetAddress): Promise<string | null> {
    if (!this.client) {
      throw new Error("Device not connected");
    }

    try {
      // Get secp256k1 pubkey using GridPlus client instance
      // Use FULL path - MAYAChain uses standard BIP44: m/44'/931'/0'/0/0 (5 levels)
      const addresses = await this.client!.getAddresses({
        startPath: msg.addressNList,
        n: 1,
        flag: Constants.GET_ADDR_FLAGS.SECP256K1_PUB,
      });

      if (!addresses || addresses.length === 0) {
        throw new Error("No address returned from device");
      }

      // GridPlus SDK returns uncompressed 65-byte pubkeys, but MAYAChain needs compressed 33-byte pubkeys
      const pubkeyBuffer = Buffer.isBuffer(addresses[0]) ? addresses[0] : Buffer.from(addresses[0], "hex");
      const compressedPubkey = pointCompress(pubkeyBuffer, true);
      const compressedHex = Buffer.from(compressedPubkey).toString("hex");
      const mayaAddress = this.createCosmosAddress(compressedHex, "maya");

      return mayaAddress;
    } catch (error) {
      throw error;
    }
  }

  public async mayachainSignTx(msg: core.MayachainSignTx): Promise<core.MayachainSignedTx | null> {
    if (!this.client) {
      throw new Error("Device not connected");
    }

    try {
      // Get the address for this path
      const address = await this.mayachainGetAddress({ addressNList: msg.addressNList });
      if (!address) throw new Error("Failed to get MAYAchain address");

      // Get the public key using client instance
      const pubkeys = await this.client!.getAddresses({
        startPath: msg.addressNList,
        n: 1,
        flag: Constants.GET_ADDR_FLAGS.SECP256K1_PUB,
      });

      if (!pubkeys || pubkeys.length === 0) {
        throw new Error("No public key returned from device");
      }

      // GridPlus SDK returns uncompressed 65-byte pubkeys, but MAYAChain needs compressed 33-byte pubkeys
      const pubkeyBuffer = Buffer.isBuffer(pubkeys[0]) ? pubkeys[0] : Buffer.from(pubkeys[0], "hex");
      const compressedPubkey = pointCompress(pubkeyBuffer, true);
      const pubkey = Buffer.from(compressedPubkey);

      // Capture client reference for use in closure
      const client = this.client;

      // Create a signer adapter for GridPlus with Direct signing (Proto)
      const signer: OfflineDirectSigner = {
        getAccounts: async () => [{
          address,
          pubkey,
          algo: "secp256k1" as const,
        }],
        signDirect: async (signerAddress: string, signDoc: SignDoc): Promise<DirectSignResponse> => {
          if (signerAddress !== address) {
            throw new Error("Signer address mismatch");
          }

          // Use CosmJS to create the sign bytes from the SignDoc
          const signBytes = (await cosmJsProtoSigning).makeSignBytes(signDoc);

          // Sign using GridPlus SDK general signing
          // Pass unhashed signBytes and let device hash with SHA256
          const signData = {
            data: {
              payload: signBytes,
              curveType: Constants.SIGNING.CURVES.SECP256K1,
              hashType: Constants.SIGNING.HASHES.SHA256,
              encodingType: Constants.SIGNING.ENCODINGS.NONE,
              signerPath: msg.addressNList,
            }
          };

          const signedResult = await client.sign(signData);

          if (!signedResult?.sig) {
            throw new Error("No signature returned from device");
          }

          const { r, s } = signedResult.sig;
          const rBuf = Buffer.from(r);
          const sBuf = Buffer.from(s);

          // Ensure 32-byte values
          const rPadded = rBuf.length < 32 ? Buffer.concat([Buffer.alloc(32 - rBuf.length), rBuf]) : rBuf;
          const sPadded = sBuf.length < 32 ? Buffer.concat([Buffer.alloc(32 - sBuf.length), sBuf]) : sBuf;

          const signature = Buffer.concat([rPadded, sPadded]);

          return {
            signed: signDoc,
            signature: {
              pub_key: {
                type: "tendermint/PubKeySecp256k1",
                value: pubkey.toString("base64"),
              },
              signature: signature.toString("base64"),
            },
          };
        },
      };

      // Build and sign transaction using proto-tx-builder
      const signedTx = await (await import("@shapeshiftoss/proto-tx-builder")).sign(
        address,
        msg.tx as any,
        signer,
        {
          sequence: Number(msg.sequence),
          accountNumber: Number(msg.account_number),
          chainId: msg.chain_id,
        },
        "maya",
      );

      return signedTx as core.MayachainSignedTx;
    } catch (error) {
      throw error;
    }
  }

  public mayachainGetAccountPaths(msg: core.MayachainGetAccountPaths): Array<core.MayachainAccountPath> {
    const slip44 = core.slip44ByCoin("Mayachain");
    return [
      {
        addressNList: [0x80000000 + 44, 0x80000000 + slip44, 0x80000000 + msg.accountIdx, 0, 0],
      },
    ];
  }

  public mayachainNextAccountPath(msg: core.MayachainAccountPath): core.MayachainAccountPath | undefined {
    const newAddressNList = [...msg.addressNList];
    newAddressNList[2] += 1;
    return {
      addressNList: newAddressNList,
    };
  }
}

export class GridPlusWalletInfo implements core.HDWalletInfo, core.ETHWalletInfo, core.CosmosWalletInfo, core.ThorchainWalletInfo, core.MayachainWalletInfo {
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
  readonly _supportsCosmosInfo = true;
  readonly _supportsThorchainInfo = true;
  readonly _supportsMayachainInfo = true;

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

  // Cosmos Wallet Info Methods
  public cosmosGetAccountPaths(msg: core.CosmosGetAccountPaths): Array<core.CosmosAccountPath> {
    const slip44 = core.slip44ByCoin("Atom");
    return [
      {
        addressNList: [0x80000000 + 44, 0x80000000 + slip44, 0x80000000 + msg.accountIdx, 0, 0],
      },
    ];
  }

  public cosmosNextAccountPath(msg: core.CosmosAccountPath): core.CosmosAccountPath | undefined {
    const newAddressNList = [...msg.addressNList];
    newAddressNList[2] += 1;
    return {
      addressNList: newAddressNList,
    };
  }

  // THORChain Wallet Info Methods
  public thorchainGetAccountPaths(msg: core.ThorchainGetAccountPaths): Array<core.ThorchainAccountPath> {
    const slip44 = core.slip44ByCoin("Rune");
    return [
      {
        addressNList: [0x80000000 + 44, 0x80000000 + slip44, 0x80000000 + msg.accountIdx, 0, 0],
      },
    ];
  }

  public thorchainNextAccountPath(msg: core.ThorchainAccountPath): core.ThorchainAccountPath | undefined {
    const newAddressNList = [...msg.addressNList];
    newAddressNList[2] += 1;
    return {
      addressNList: newAddressNList,
    };
  }

  public mayachainGetAccountPaths(msg: core.MayachainGetAccountPaths): Array<core.MayachainAccountPath> {
    const slip44 = core.slip44ByCoin("Mayachain");
    return [
      {
        addressNList: [0x80000000 + 44, 0x80000000 + slip44, 0x80000000 + msg.accountIdx, 0, 0],
      },
    ];
  }

  public mayachainNextAccountPath(msg: core.MayachainAccountPath): core.MayachainAccountPath | undefined {
    const newAddressNList = [...msg.addressNList];
    newAddressNList[2] += 1;
    return {
      addressNList: newAddressNList,
    };
  }

}
