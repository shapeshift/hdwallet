import type { StdTx } from "@cosmjs/amino";
import type { DirectSignResponse, OfflineDirectSigner } from "@cosmjs/proto-signing";
import type { SignerData } from "@cosmjs/stargate";
import { pointCompress } from "@bitcoinerlab/secp256k1";
import type { SignDoc } from "cosmjs-types/cosmos/tx/v1beta1/tx";
import Common from "@ethereumjs/common";
import { FeeMarketEIP1559Transaction, Transaction } from "@ethereumjs/tx";
import { SignTypedDataVersion, TypedDataUtils } from "@metamask/eth-sig-util";
import * as core from "@shapeshiftoss/hdwallet-core";
import * as bech32 from "bech32";
import bs58 from "bs58";
import { decode as bs58Decode, encode as bs58Encode } from "bs58check";
import CryptoJS from "crypto-js";
import {
  Client,
  Constants,
  Utils,
  fetchAddresses,
  fetchSolanaAddresses,
  fetchBtcLegacyAddresses,
  fetchBtcSegwitAddresses,
  fetchBtcWrappedSegwitAddresses,
  fetchAddressesByDerivationPath,
  signSolanaTx,
  signBtcLegacyTx,
  signBtcSegwitTx,
  signBtcWrappedSegwitTx,
} from "gridplus-sdk";
import isObject from "lodash/isObject";
import PLazy from "p-lazy";
import { encode } from "rlp";

const protoTxBuilder = PLazy.from(() => import("@shapeshiftoss/proto-tx-builder"));
const cosmJsProtoSigning = PLazy.from(() => import("@cosmjs/proto-signing"));

import { GridPlusTransport } from "./transport";

export function isGridPlus(wallet: core.HDWallet): wallet is GridPlusHDWallet {
  return isObject(wallet) && (wallet as any)._isGridPlus;
}

// UTXO account types for xpub conversion
enum UtxoAccountType {
  P2pkh = "P2pkh",
  SegwitNative = "SegwitNative",
  SegwitP2sh = "SegwitP2sh",
}

// xpub version prefixes
enum PublicKeyType {
  xpub = "0488b21e",
  ypub = "049d7cb2",
  zpub = "04b24746",
  dgub = "02facafd",
  Ltub = "019da462",
  Mtub = "01b26ef6",
}

const accountTypeToVersion = (() => {
  const Litecoin = {
    [UtxoAccountType.P2pkh]: Buffer.from(PublicKeyType.Ltub, "hex"),
    [UtxoAccountType.SegwitP2sh]: Buffer.from(PublicKeyType.Mtub, "hex"),
    [UtxoAccountType.SegwitNative]: Buffer.from(PublicKeyType.zpub, "hex"),
  };

  const Dogecoin = {
    [UtxoAccountType.P2pkh]: Buffer.from(PublicKeyType.dgub, "hex"),
  };

  const Bitcoin = {
    [UtxoAccountType.P2pkh]: Buffer.from(PublicKeyType.xpub, "hex"),
    [UtxoAccountType.SegwitP2sh]: Buffer.from(PublicKeyType.ypub, "hex"),
    [UtxoAccountType.SegwitNative]: Buffer.from(PublicKeyType.zpub, "hex"),
  };

  return (coin: string, type: UtxoAccountType) => {
    switch (coin) {
      case "Litecoin":
        return Litecoin[type];
      case "Bitcoin":
        return Bitcoin[type];
      case "Dogecoin":
        if (type !== UtxoAccountType.P2pkh) throw new Error("Unsupported account type");
        return Dogecoin[type];
      default:
        return Bitcoin[type];
    }
  };
})();

const convertVersions = ["Ltub", "xpub", "dgub"];

/**
 * Convert xpub version bytes for different coins (e.g., xpub → dgub for Dogecoin)
 * GridPlus returns Bitcoin-format xpubs, but some coins like Dogecoin need different prefixes
 */
function convertXpubVersion(xpub: string, accountType: UtxoAccountType | undefined, coin: string): string {
  if (!accountType) return xpub;
  if (!convertVersions.includes(xpub.substring(0, 4))) {
    return xpub;
  }

  const payload = bs58Decode(xpub);
  const version = payload.slice(0, 4);
  const desiredVersion = accountTypeToVersion(coin, accountType);
  if (version.compare(desiredVersion) !== 0) {
    const key = payload.slice(4);
    return bs58Encode(Buffer.concat([desiredVersion, key]));
  }
  return xpub;
}

function scriptTypeToAccountType(scriptType: core.BTCInputScriptType | undefined): UtxoAccountType | undefined {
  switch (scriptType) {
    case core.BTCInputScriptType.SpendAddress:
      return UtxoAccountType.P2pkh;
    case core.BTCInputScriptType.SpendWitness:
      return UtxoAccountType.SegwitNative;
    case core.BTCInputScriptType.SpendP2SHWitness:
      return UtxoAccountType.SegwitP2sh;
    default:
      return undefined;
  }
}

/**
 * Network parameters for UTXO coins
 */
const UTXO_NETWORK_PARAMS: Record<string, { pubKeyHash: number; scriptHash: number; bech32?: string }> = {
  Bitcoin: { pubKeyHash: 0x00, scriptHash: 0x05, bech32: "bc" },
  Dogecoin: { pubKeyHash: 0x1e, scriptHash: 0x16 },
  Litecoin: { pubKeyHash: 0x30, scriptHash: 0x32, bech32: "ltc" },
  BitcoinCash: { pubKeyHash: 0x00, scriptHash: 0x05 },
};

/**
 * Derive a UTXO address from a compressed public key
 * @param pubkeyHex - Compressed public key as hex string (33 bytes, starting with 02 or 03)
 * @param coin - Coin name (Bitcoin, Dogecoin, Litecoin, etc.)
 * @param scriptType - Script type (p2pkh, p2wpkh, p2sh-p2wpkh)
 * @returns The derived address
 */
function deriveAddressFromPubkey(
  pubkeyHex: string,
  coin: string,
  scriptType: core.BTCInputScriptType = core.BTCInputScriptType.SpendAddress
): string {
  const network = UTXO_NETWORK_PARAMS[coin] || UTXO_NETWORK_PARAMS.Bitcoin;
  const pubkeyBuffer = Buffer.from(pubkeyHex, "hex");

  if (pubkeyBuffer.length !== 33) {
    throw new Error(`Invalid compressed public key length: ${pubkeyBuffer.length} bytes`);
  }

  // Hash160 = RIPEMD160(SHA256(pubkey))
  const sha256Hash = CryptoJS.SHA256(CryptoJS.enc.Hex.parse(pubkeyHex));
  const hash160 = CryptoJS.RIPEMD160(sha256Hash).toString();
  const hash160Buffer = Buffer.from(hash160, "hex");

  switch (scriptType) {
    case core.BTCInputScriptType.SpendAddress: {
      // P2PKH: <pubKeyHash version byte> + hash160 + checksum
      const payload = Buffer.concat([Buffer.from([network.pubKeyHash]), hash160Buffer]);
      return bs58Encode(payload);
    }

    case core.BTCInputScriptType.SpendWitness: {
      // P2WPKH (bech32): witness version 0 + hash160
      if (!network.bech32) {
        throw new Error(`Bech32 not supported for ${coin}`);
      }
      const words = bech32.toWords(hash160Buffer);
      words.unshift(0); // witness version 0
      return bech32.encode(network.bech32, words);
    }

    case core.BTCInputScriptType.SpendP2SHWitness: {
      // P2SH-P2WPKH: scriptHash of witness program
      // Witness program: OP_0 (0x00) + length (0x14) + hash160
      const witnessProgram = Buffer.concat([Buffer.from([0x00, 0x14]), hash160Buffer]);

      // Hash160 of witness program
      const wpHex = witnessProgram.toString("hex");
      const wpSha256 = CryptoJS.SHA256(CryptoJS.enc.Hex.parse(wpHex));
      const wpHash160 = CryptoJS.RIPEMD160(wpSha256).toString();
      const wpHash160Buffer = Buffer.from(wpHash160, "hex");

      // Encode with scriptHash version byte
      const payload = Buffer.concat([Buffer.from([network.scriptHash]), wpHash160Buffer]);
      return bs58Encode(payload);
    }

    default:
      throw new Error(`Unsupported script type: ${scriptType}`);
  }
}

export class GridPlusHDWallet implements core.HDWallet, core.ETHWallet, core.SolanaWallet, core.BTCWallet, core.CosmosWallet, core.ThorchainWallet, core.MayachainWallet {
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

  public async getPublicKeys(msg: Array<core.GetPublicKey>): Promise<Array<core.PublicKey | null>> {
    if (!this.client) {
      throw new Error("Device not connected");
    }

    const publicKeys: Array<core.PublicKey | null> = [];

    for (const getPublicKey of msg) {
      const { addressNList, curve, coin, scriptType } = getPublicKey;
      // fetchAddressesByDerivationPath expects path without "m/" prefix
      const path = core.addressNListToBIP32(addressNList).replace(/^m\//, "");

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

        console.log(`GridPlus getPublicKeys: fetching for path=${path}, curve=${curve}, flag=${flag}, coin=${coin}`);

        const addresses = await fetchAddressesByDerivationPath(path, {
          n: 1,
          startPathIndex: 0,
          flag,
        });

        console.log(`GridPlus getPublicKeys: received addresses=`, addresses);

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

        console.log(`GridPlus getPublicKeys: returning xpub=${xpub}`);
        publicKeys.push({ xpub });
      } catch (error) {
        console.error(`GridPlus getPublicKeys ERROR for path ${path}, curve=${curve}, coin=${coin}:`, error);
        console.error(`GridPlus getPublicKeys ERROR stack:`, error instanceof Error ? error.stack : 'no stack');
        publicKeys.push(null);
      }
    }

    return publicKeys;
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
      // Extract address index from EVM path: m/44'/60'/0'/0/X
      // addressNList = [44', 60', 0', 0, X]
      const addressIndex = msg.addressNList[4] || 0;
      const startPath = [...msg.addressNList.slice(0, 4), addressIndex];

      // Fetch only the requested address
      const addresses = await fetchAddresses({
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

      // Cache the address
      const pathKey = JSON.stringify(msg.addressNList);
      this.addressCache.set(pathKey, address.toLowerCase());

      // core.Address for ETH is just a string type `0x${string}`
      return address.toLowerCase() as core.Address;
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

      // Fetch only the requested account (Solana has one address per account)
      const solanaAddresses = await fetchSolanaAddresses({
        n: 1,  // Only fetch the requested account
        startPathIndex: accountIdx
      });

      if (!solanaAddresses || !solanaAddresses.length) {
        throw new Error("No address returned from device");
      }

      // Encode and cache the address
      const addressBuffer = solanaAddresses[0];
      if (!Buffer.isBuffer(addressBuffer)) {
        throw new Error("Invalid address format from device");
      }

      const address = bs58.encode(addressBuffer);
      this.addressCache.set(pathKey, address);

      return address;
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
      const serialized = transaction.serialize();

      // Use GridPlus SDK's signSolanaTx wrapper with custom signer path
      // The SDK's default SOLANA_DERIVATION is hardcoded, so we pass our path in overrides
      // ED25519 requires ALL path indices to be hardened (>= 0x80000000)
      const hardenedPath = msg.addressNList.map(index =>
        index >= 0x80000000 ? index : index + 0x80000000
      );
      const signData = await signSolanaTx(Buffer.from(serialized), {
        signerPath: hardenedPath,
      } as any);

      if (!signData || (!signData.sigs || signData.sigs.length === 0)) {
        throw new Error("No signature returned from device");
      }

      return {
        serialized: Buffer.from(serialized).toString("base64"),
        signatures: signData.sigs.map(sig => sig.toString("base64")),
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
    const pathKey = JSON.stringify(msg.addressNList);
    const cached = this.addressCache.get(pathKey);
    if (cached) return cached as string;

    // Get compressed public key from device (works for all UTXO coins)
    // Using SECP256K1_PUB flag bypasses Lattice's address formatting,
    // which only supports Bitcoin/Ethereum/Solana
    const pubkeys = await fetchAddresses({
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

    // Cache and return
    this.addressCache.set(pathKey, address);
    return address;
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
        signerPath: input.addressNList,
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

      // For BTC, signatures are in sig object (r, s) or sigs array
      const signatures = signData.sigs ? signData.sigs.map(s => s.toString("hex")) : [];

      return {
        signatures,
        serializedTx: signData.tx,
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

    // Include prefix in cache key to avoid collision with THORChain/MAYAChain (same slip44)
    const pathKey = JSON.stringify({ path: msg.addressNList, prefix: "cosmos" });
    const cached = this.addressCache.get(pathKey);
    if (cached) return cached as string;

    try {
      // Get secp256k1 pubkey using GridPlus SDK
      // Use FULL path - Cosmos uses standard BIP44: m/44'/118'/0'/0/0 (5 levels)
      const path = core.addressNListToBIP32(msg.addressNList).replace(/^m\//, "");

      const addresses = await fetchAddressesByDerivationPath(path, {
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
      this.addressCache.set(pathKey, cosmosAddress);

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

      // Get the public key
      const path = core.addressNListToBIP32(msg.addressNList).replace(/^m\//, "");
      const pubkeys = await fetchAddressesByDerivationPath(path, {
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
          const hash = CryptoJS.SHA256(CryptoJS.lib.WordArray.create(signBytes as any));
          const hashBuffer = Buffer.from(hash.toString(CryptoJS.enc.Hex), "hex");

          // Sign using GridPlus SDK general signing
          const signData = {
            data: {
              payload: hashBuffer,
              curveType: Constants.SIGNING.CURVES.SECP256K1,
              hashType: Constants.SIGNING.HASHES.NONE, // Already hashed
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
    // Include prefix in cache key to avoid collision with MAYAChain (same slip44: 931)
    const pathKey = JSON.stringify({ path: msg.addressNList, prefix });
    const cached = this.addressCache.get(pathKey);
    if (cached) return cached as string;

    try {
      // Get secp256k1 pubkey using GridPlus SDK
      // Use FULL path - THORChain uses standard BIP44: m/44'/931'/0'/0/0 (5 levels)
      const path = core.addressNListToBIP32(msg.addressNList).replace(/^m\//, "");

      const addresses = await fetchAddressesByDerivationPath(path, {
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
      this.addressCache.set(pathKey, thorAddress);

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

      // Get the public key
      const path = core.addressNListToBIP32(msg.addressNList).replace(/^m\//, "");
      const pubkeys = await fetchAddressesByDerivationPath(path, {
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
          const hash = CryptoJS.SHA256(CryptoJS.lib.WordArray.create(signBytes as any));
          const hashBuffer = Buffer.from(hash.toString(CryptoJS.enc.Hex), "hex");

          // Sign using GridPlus SDK general signing
          const signData = {
            data: {
              payload: hashBuffer,
              curveType: Constants.SIGNING.CURVES.SECP256K1,
              hashType: Constants.SIGNING.HASHES.NONE, // Already hashed
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

    // Include prefix in cache key to avoid collision with THORChain (same slip44: 931)
    const pathKey = JSON.stringify({ path: msg.addressNList, prefix: "maya" });
    const cached = this.addressCache.get(pathKey);
    if (cached) return cached as string;

    try {
      // Get secp256k1 pubkey using GridPlus SDK
      // Use FULL path - MAYAChain uses standard BIP44: m/44'/931'/0'/0/0 (5 levels)
      const path = core.addressNListToBIP32(msg.addressNList).replace(/^m\//, "");

      const addresses = await fetchAddressesByDerivationPath(path, {
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
      this.addressCache.set(pathKey, mayaAddress);

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

      // Get the public key
      const path = core.addressNListToBIP32(msg.addressNList).replace(/^m\//, "");
      const pubkeys = await fetchAddressesByDerivationPath(path, {
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
          const hash = CryptoJS.SHA256(CryptoJS.lib.WordArray.create(signBytes as any));
          const hashBuffer = Buffer.from(hash.toString(CryptoJS.enc.Hex), "hex");

          // Sign using GridPlus SDK general signing
          const signData = {
            data: {
              payload: hashBuffer,
              curveType: Constants.SIGNING.CURVES.SECP256K1,
              hashType: Constants.SIGNING.HASHES.NONE, // Already hashed
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
