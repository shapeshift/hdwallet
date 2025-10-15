import * as core from "@shapeshiftoss/hdwallet-core";
import { Client, Constants } from "gridplus-sdk";
import isObject from "lodash/isObject";

import * as btc from "./bitcoin";
import * as cosmos from "./cosmos";
import * as eth from "./ethereum";
import * as solana from "./solana";
import * as thormaya from "./thormaya";
import { GridPlusTransport } from "./transport";
import { convertXpubVersion, scriptTypeToAccountType } from "./utils";

export function isGridPlus(wallet: core.HDWallet): wallet is GridPlusHDWallet {
  return isObject(wallet) && (wallet as any)._isGridPlus;
}

export class GridPlusHDWallet
  implements
    core.HDWallet,
    core.ETHWallet,
    core.SolanaWallet,
    core.BTCWallet,
    core.CosmosWallet,
    core.ThorchainWallet,
    core.MayachainWallet
{
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
    if (!this.client) return;
    await this.transport.disconnect();
    this.client = undefined;
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
    if (typeof this.client.getAddresses !== "function") {
      throw new Error("GridPlus client missing required getAddresses method");
    }
  }

  public async ping(msg: core.Ping): Promise<core.Pong> {
    return { msg: msg.msg };
  }

  public async sendPin(): Promise<void> {}

  public async sendPassphrase(): Promise<void> {}

  public async sendCharacter(): Promise<void> {}

  public async sendWord(): Promise<void> {}

  public async cancel(): Promise<void> {
    // GridPlus has no pending device interactions to cancel
    // Wallet persists in keyring - do not disconnect
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
    return this.activeWalletId || (await this.transport.getDeviceID());
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

        if (!addresses.length) {
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

  public async ethSupportsNetwork(chainId: number): Promise<boolean> {
    return eth.ethSupportsNetwork(chainId);
  }

  public async ethSupportsSecureTransfer(): Promise<boolean> {
    return eth.ethSupportsSecureTransfer();
  }

  public ethSupportsNativeShapeShift(): boolean {
    return eth.ethSupportsNativeShapeShift();
  }

  public async ethSupportsEIP1559(): Promise<boolean> {
    return eth.ethSupportsEIP1559();
  }

  public ethGetAccountPaths(msg: core.ETHGetAccountPath): Array<core.ETHAccountPath> {
    return eth.ethGetAccountPaths(msg);
  }

  public ethNextAccountPath(msg: core.ETHAccountPath): core.ETHAccountPath | undefined {
    return eth.ethNextAccountPath(msg);
  }

  public async ethGetAddress(msg: core.ETHGetAddress): Promise<core.Address | null> {
    if (!this.client) {
      throw new Error("Device not connected");
    }
    return eth.ethGetAddress(this.client, msg);
  }

  public solanaGetAccountPaths(msg: core.SolanaGetAccountPaths): Array<core.SolanaAccountPath> {
    return solana.solanaGetAccountPaths(msg);
  }

  public async solanaGetAddress(msg: core.SolanaGetAddress): Promise<string | null> {
    if (!this.client) {
      throw new Error("Device not connected");
    }
    return solana.solanaGetAddress(this.client!, msg);
  }

  public async solanaSignTx(msg: core.SolanaSignTx): Promise<core.SolanaSignedTx | null> {
    if (!this.client) {
      throw new Error("Device not connected");
    }
    return solana.solanaSignTx(this.client!, this.solanaGetAddress.bind(this), msg);
  }

  public solanaNextAccountPath(msg: core.SolanaAccountPath): core.SolanaAccountPath | undefined {
    return solana.solanaNextAccountPath(msg);
  }

  public async ethSignTx(msg: core.ETHSignTx): Promise<core.ETHSignedTx> {
    if (!this.client) {
      throw new Error("Device not connected");
    }
    return eth.ethSignTx(this.client!, msg);
  }

  public async ethSignTypedData(msg: core.ETHSignTypedData): Promise<core.ETHSignedTypedData> {
    if (!this.client) {
      throw new Error("Device not connected");
    }
    return eth.ethSignTypedData(this.client!, this.ethGetAddress.bind(this), msg);
  }

  public async ethSignMessage(msg: core.ETHSignMessage): Promise<core.ETHSignedMessage> {
    if (!this.client) {
      throw new Error("Device not connected");
    }
    return eth.ethSignMessage(this.client!, this.ethGetAddress.bind(this), msg);
  }

  public async ethVerifyMessage(msg: core.ETHVerifyMessage): Promise<boolean> {
    return eth.ethVerifyMessage(msg);
  }

  public async btcSupportsCoin(coin: core.Coin): Promise<boolean> {
    // Validates supported UTXO coins - used by bitcoin.ts for coin-specific logic
    return ["Bitcoin", "Dogecoin", "Litecoin", "BitcoinCash"].includes(coin);
  }

  public async btcSupportsScriptType(coin: core.Coin, scriptType?: core.BTCInputScriptType): Promise<boolean> {
    const supported = {
      Bitcoin: [
        core.BTCInputScriptType.SpendAddress, // p2pkh
        core.BTCInputScriptType.SpendP2SHWitness, // p2sh-p2wpkh
        core.BTCInputScriptType.SpendWitness, // p2wpkh
      ],
      Dogecoin: [core.BTCInputScriptType.SpendAddress], // p2pkh only
      Litecoin: [
        core.BTCInputScriptType.SpendAddress, // p2pkh
        core.BTCInputScriptType.SpendP2SHWitness, // p2sh-p2wpkh
        core.BTCInputScriptType.SpendWitness, // p2wpkh
      ],
      BitcoinCash: [core.BTCInputScriptType.SpendAddress], // p2pkh only
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
    return btc.btcGetAccountPaths(msg);
  }

  public async btcGetAddress(msg: core.BTCGetAddress): Promise<string | null> {
    if (!this.client) {
      throw new Error("Device not connected");
    }
    return btc.btcGetAddress(this.client!, msg);
  }

  public async btcSignTx(msg: core.BTCSignTx): Promise<core.BTCSignedTx | null> {
    if (!this.client) {
      throw new Error("Device not connected");
    }
    return btc.btcSignTx(this.client!, msg);
  }

  public btcNextAccountPath(msg: core.BTCAccountPath): core.BTCAccountPath | undefined {
    return btc.btcNextAccountPath(msg);
  }

  public async btcSignMessage(msg: core.BTCSignMessage): Promise<core.BTCSignedMessage | null> {
    throw new Error("GridPlus BTC message signing not yet implemented");
  }

  public async btcVerifyMessage(msg: core.BTCVerifyMessage): Promise<boolean | null> {
    throw new Error("GridPlus BTC message verification not yet implemented");
  }

  private bech32ify(address: ArrayLike<number>, prefix: string): string {
    return cosmos.bech32ify(address, prefix);
  }

  private createCosmosAddress(publicKey: string, prefix: string): string {
    return cosmos.createCosmosAddress(publicKey, prefix);
  }

  public async cosmosGetAddress(msg: core.CosmosGetAddress): Promise<string | null> {
    if (!this.client) {
      throw new Error("Device not connected");
    }
    return cosmos.cosmosGetAddress(this.client!, msg);
  }

  public async cosmosSignTx(msg: core.CosmosSignTx): Promise<core.CosmosSignedTx | null> {
    if (!this.client) {
      throw new Error("Device not connected");
    }
    return cosmos.cosmosSignTx(this.client!, this.cosmosGetAddress.bind(this), msg);
  }

  public cosmosGetAccountPaths(msg: core.CosmosGetAccountPaths): Array<core.CosmosAccountPath> {
    return cosmos.cosmosGetAccountPaths(msg);
  }

  public cosmosNextAccountPath(msg: core.CosmosAccountPath): core.CosmosAccountPath | undefined {
    return cosmos.cosmosNextAccountPath(msg);
  }

  public async thorchainGetAddress(msg: core.ThorchainGetAddress): Promise<string | null> {
    if (!this.client) {
      throw new Error("Device not connected");
    }
    return thormaya.thorchainGetAddress(this.client!, msg);
  }

  public async thorchainSignTx(msg: core.ThorchainSignTx): Promise<core.ThorchainSignedTx | null> {
    if (!this.client) {
      throw new Error("Device not connected");
    }
    return thormaya.thorchainSignTx(this.client!, this.thorchainGetAddress.bind(this), msg);
  }

  public thorchainGetAccountPaths(msg: core.ThorchainGetAccountPaths): Array<core.ThorchainAccountPath> {
    return thormaya.thorchainGetAccountPaths(msg);
  }

  public thorchainNextAccountPath(msg: core.ThorchainAccountPath): core.ThorchainAccountPath | undefined {
    return thormaya.thorchainNextAccountPath(msg);
  }

  public async mayachainGetAddress(msg: core.MayachainGetAddress): Promise<string | null> {
    if (!this.client) {
      throw new Error("Device not connected");
    }
    return thormaya.mayachainGetAddress(this.client!, msg);
  }

  public async mayachainSignTx(msg: core.MayachainSignTx): Promise<core.MayachainSignedTx | null> {
    if (!this.client) {
      throw new Error("Device not connected");
    }
    return thormaya.mayachainSignTx(this.client!, this.mayachainGetAddress.bind(this), msg);
  }

  public mayachainGetAccountPaths(msg: core.MayachainGetAccountPaths): Array<core.MayachainAccountPath> {
    return thormaya.mayachainGetAccountPaths(msg);
  }

  public mayachainNextAccountPath(msg: core.MayachainAccountPath): core.MayachainAccountPath | undefined {
    return thormaya.mayachainNextAccountPath(msg);
  }
}

export class GridPlusWalletInfo
  implements
    core.HDWalletInfo,
    core.ETHWalletInfo,
    core.CosmosWalletInfo,
    core.ThorchainWalletInfo,
    core.MayachainWalletInfo
{
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
