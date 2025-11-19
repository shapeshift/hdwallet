import * as core from "@shapeshiftoss/hdwallet-core";
import { Client, Constants } from "gridplus-sdk";
import isObject from "lodash/isObject";

import * as btc from "./bitcoin";
import * as cosmos from "./cosmos";
import * as eth from "./ethereum";
import * as mayachain from "./mayachain";
import * as solana from "./solana";
import * as thorchain from "./thorchain";
import { convertXpubVersion, scriptTypeToAccountType } from "./utils";

export function isGridPlus(wallet: core.HDWallet): wallet is GridPlusHDWallet {
  return isObject(wallet) && (wallet as any)._isGridPlus;
}

export class GridPlusWalletInfo
  implements
    core.HDWalletInfo,
    core.BTCWalletInfo,
    core.CosmosWalletInfo,
    core.ETHWalletInfo,
    core.MayachainWalletInfo,
    core.SolanaWalletInfo,
    core.ThorchainWalletInfo
{
  readonly _supportsBTCInfo = true;
  readonly _supportsCosmosInfo = true;
  readonly _supportsETHInfo = true;
  readonly _supportsMayachainInfo = true;
  readonly _supportsSolanaInfo = true;
  readonly _supportsThorchainInfo = true;

  getVendor(): string {
    return "GridPlus";
  }

  hasOnDevicePinEntry(): boolean {
    return false;
  }

  hasOnDevicePassphrase(): boolean {
    return false;
  }

  hasOnDeviceDisplay(): boolean {
    return true;
  }

  hasOnDeviceRecovery(): boolean {
    return false;
  }

  hasNativeShapeShift(): boolean {
    return false;
  }

  supportsBip44Accounts(): boolean {
    return true;
  }

  supportsOfflineSigning(): boolean {
    return true;
  }

  supportsBroadcast(): boolean {
    return false;
  }

  describePath(): core.PathDescription {
    return {
      verbose: "GridPlus path description not implemented",
      coin: "Unknown",
      isKnown: false,
    };
  }

  /**
   * Bitcoin Wallet Info
   */
  async btcSupportsCoin(coin: core.Coin): Promise<boolean> {
    const supportedCoins = ["Bitcoin", "BitcoinCash", "Litecoin", "Dogecoin"];
    return supportedCoins.includes(coin);
  }

  async btcSupportsScriptType(coin: core.Coin, scriptType: core.BTCInputScriptType): Promise<boolean> {
    switch (scriptType) {
      case core.BTCInputScriptType.SpendAddress:
        return ["Bitcoin", "BitcoinCash", "Litecoin", "Dogecoin"].includes(coin);
      case core.BTCInputScriptType.SpendP2SHWitness:
        return ["Bitcoin", "BitcoinCash", "Litecoin"].includes(coin);
      case core.BTCInputScriptType.SpendWitness:
        return ["Bitcoin", "BitcoinCash", "Litecoin"].includes(coin);
      default:
        return false;
    }
  }

  async btcSupportsSecureTransfer(): Promise<boolean> {
    return false;
  }

  btcSupportsNativeShapeShift(): boolean {
    return false;
  }

  btcGetAccountPaths(msg: core.BTCGetAccountPaths): Array<core.BTCAccountPath> {
    const slip44 = core.slip44ByCoin(msg.coin);
    if (slip44 === undefined) return [];

    const bip44 = core.legacyAccount(msg.coin, slip44, msg.accountIdx);
    const bip49 = core.segwitAccount(msg.coin, slip44, msg.accountIdx);
    const bip84 = core.segwitNativeAccount(msg.coin, slip44, msg.accountIdx);

    const coinPaths: Record<string, Array<core.BTCAccountPath>> = {
      bitcoin: [bip44, bip49, bip84],
      bitcoincash: [bip44, bip49, bip84],
      dogecoin: [bip44],
      litecoin: [bip44, bip49, bip84],
    };

    const paths = coinPaths[msg.coin.toLowerCase()] || [];

    if (msg.scriptType !== undefined) {
      return paths.filter((path) => path.scriptType === msg.scriptType);
    }

    return paths;
  }

  btcNextAccountPath(msg: core.BTCAccountPath): core.BTCAccountPath | undefined {
    const description = core.describeUTXOPath(msg.addressNList, msg.coin, msg.scriptType);

    if (!description.isKnown) return undefined;

    const addressNList = msg.addressNList;

    if (
      (addressNList[0] === 0x80000000 + 44 && msg.scriptType == core.BTCInputScriptType.SpendAddress) ||
      (addressNList[0] === 0x80000000 + 49 && msg.scriptType == core.BTCInputScriptType.SpendP2SHWitness) ||
      (addressNList[0] === 0x80000000 + 84 && msg.scriptType == core.BTCInputScriptType.SpendWitness)
    ) {
      addressNList[2] += 1;
      return { ...msg, addressNList };
    }

    return undefined;
  }

  /**
   * Ethereum Wallet Info
   */
  async ethSupportsNetwork(chainId: number): Promise<boolean> {
    const supportedChains = [1, 137, 10, 42161, 8453, 56, 100, 43114];
    return supportedChains.includes(chainId);
  }

  async ethSupportsSecureTransfer(): Promise<boolean> {
    return false;
  }

  ethSupportsNativeShapeShift(): boolean {
    return false;
  }

  async ethSupportsEIP1559(): Promise<boolean> {
    return true;
  }

  ethGetAccountPaths(msg: core.ETHGetAccountPath): Array<core.ETHAccountPath> {
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

  ethNextAccountPath(msg: core.ETHAccountPath): core.ETHAccountPath | undefined {
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
  solanaGetAccountPaths(msg: core.SolanaGetAccountPaths): Array<core.SolanaAccountPath> {
    return [{ addressNList: [0x80000000 + 44, 0x80000000 + 501, 0x80000000 + msg.accountIdx, 0x80000000 + 0] }];
  }

  solanaNextAccountPath(msg: core.SolanaAccountPath): core.SolanaAccountPath | undefined {
    // Increment account index for next account
    const newAddressNList = [...msg.addressNList];
    newAddressNList[2] += 1; // Increment account index

    return {
      addressNList: newAddressNList,
    };
  }

  // Cosmos Wallet Info Methods
  cosmosGetAccountPaths(msg: core.CosmosGetAccountPaths): Array<core.CosmosAccountPath> {
    const slip44 = core.slip44ByCoin("Atom");
    return [
      {
        addressNList: [0x80000000 + 44, 0x80000000 + slip44, 0x80000000 + msg.accountIdx, 0, 0],
      },
    ];
  }

  cosmosNextAccountPath(msg: core.CosmosAccountPath): core.CosmosAccountPath | undefined {
    const newAddressNList = [...msg.addressNList];
    newAddressNList[2] += 1;
    return {
      addressNList: newAddressNList,
    };
  }

  // THORChain Wallet Info Methods
  thorchainGetAccountPaths(msg: core.ThorchainGetAccountPaths): Array<core.ThorchainAccountPath> {
    const slip44 = core.slip44ByCoin("Rune");
    return [
      {
        addressNList: [0x80000000 + 44, 0x80000000 + slip44, 0x80000000 + msg.accountIdx, 0, 0],
      },
    ];
  }

  thorchainNextAccountPath(msg: core.ThorchainAccountPath): core.ThorchainAccountPath | undefined {
    const newAddressNList = [...msg.addressNList];
    newAddressNList[2] += 1;
    return {
      addressNList: newAddressNList,
    };
  }

  mayachainGetAccountPaths(msg: core.MayachainGetAccountPaths): Array<core.MayachainAccountPath> {
    const slip44 = core.slip44ByCoin("Mayachain");
    return [
      {
        addressNList: [0x80000000 + 44, 0x80000000 + slip44, 0x80000000 + msg.accountIdx, 0, 0],
      },
    ];
  }

  mayachainNextAccountPath(msg: core.MayachainAccountPath): core.MayachainAccountPath | undefined {
    const newAddressNList = [...msg.addressNList];
    newAddressNList[2] += 1;
    return {
      addressNList: newAddressNList,
    };
  }
}

export class GridPlusHDWallet
  extends GridPlusWalletInfo
  implements
    core.HDWallet,
    core.ETHWallet,
    core.SolanaWallet,
    core.BTCWallet,
    core.CosmosWallet,
    core.ThorchainWallet,
    core.MayachainWallet
{
  readonly _supportsArbitrum = true;
  readonly _supportsArbitrumNova = false;
  readonly _supportsAvalanche = true;
  readonly _supportsBSC = true;
  readonly _supportsBTC = true;
  readonly _supportsBase = true;
  readonly _supportsCosmos = true;
  readonly _supportsETH = true;
  readonly _supportsEthSwitchChain = false;
  readonly _supportsGnosis = true;
  readonly _supportsMayachain = true;
  readonly _supportsOptimism = true;
  readonly _supportsPolygon = true;
  readonly _supportsSolana = true;
  readonly _supportsThorchain = true;

  client: Client | undefined;

  constructor(client: Client) {
    super();
    this.client = client;
  }

  public async cancel(): Promise<void> {}
  public async clearSession(): Promise<void> {}
  public async initialize(): Promise<void> {}
  public async loadDevice(): Promise<void> {}
  public async recover(): Promise<void> {}
  public async reset(): Promise<void> {}
  public async sendCharacter(): Promise<void> {}
  public async sendPassphrase(): Promise<void> {}
  public async sendPin(): Promise<void> {}
  public async sendWord(): Promise<void> {}
  public async wipe(): Promise<void> {}

  public async getDeviceID(): Promise<string> {
    if (!this.client) throw new Error("Device not connected");
    return this.client.getDeviceId();
  }

  async getFeatures(): Promise<Record<string, any>> {
    if (!this.client) throw new Error("Device not connected");

    return {
      vendor: "GridPlus",
      deviceId: this.client.getDeviceId(),
      model: "Lattice1",
    };
  }

  public async getFirmwareVersion(): Promise<string> {
    if (!this.client) throw new Error("Device not connected");
    const { major, minor, fix } = this.client.getFwVersion();
    return `${major}.${minor}.${fix}`;
  }

  public async getModel(): Promise<string> {
    return "Lattice1";
  }

  public async getLabel(): Promise<string> {
    return "GridPlus Lattice1";
  }

  public async isInitialized(): Promise<boolean> {
    return Boolean(this.client);
  }

  public async isLocked(): Promise<boolean> {
    if (!this.client) throw new Error("Device not connected");
    return false;
  }

  public async ping(msg: core.Ping): Promise<core.Pong> {
    return { msg: msg.msg };
  }

  public async disconnect(): Promise<void> {
    this.client = undefined;
  }

  public getSessionId(): string | undefined {
    if (!this.client) throw new Error("Device not connected");
    return JSON.parse(this.client.getStateData())["privKey"];
  }

  public async getPublicKeys(msg: Array<core.GetPublicKey>): Promise<Array<core.PublicKey | null>> {
    if (!this.client) throw new Error("Device not connected");

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

  public async btcGetAddress(msg: core.BTCGetAddress): Promise<string | null> {
    if (!this.client) throw new Error("Device not connected");
    return btc.btcGetAddress(this.client!, msg);
  }

  public async btcSignTx(msg: core.BTCSignTx): Promise<core.BTCSignedTx | null> {
    if (!this.client) throw new Error("Device not connected");
    return btc.btcSignTx(this.client, msg);
  }

  public async btcSignMessage(): Promise<core.BTCSignedMessage | null> {
    throw new Error("GridPlus BTC message signing not yet implemented");
  }

  public async btcVerifyMessage(): Promise<boolean | null> {
    throw new Error("GridPlus BTC message verification not yet implemented");
  }

  public async ethGetAddress(msg: core.ETHGetAddress): Promise<core.Address | null> {
    if (!this.client) throw new Error("Device not connected");
    return eth.ethGetAddress(this.client, msg);
  }

  public async ethSignTx(msg: core.ETHSignTx): Promise<core.ETHSignedTx> {
    if (!this.client) throw new Error("Device not connected");
    return eth.ethSignTx(this.client, msg);
  }

  public async ethSignTypedData(msg: core.ETHSignTypedData): Promise<core.ETHSignedTypedData> {
    if (!this.client) throw new Error("Device not connected");
    return eth.ethSignTypedData(this.client, msg);
  }

  public async ethSignMessage(msg: core.ETHSignMessage): Promise<core.ETHSignedMessage> {
    if (!this.client) throw new Error("Device not connected");
    return eth.ethSignMessage(this.client, msg);
  }

  public async ethVerifyMessage(): Promise<boolean> {
    throw new Error("GridPlus ETH message verification not implemented yet");
  }

  private assertSolanaFwSupport(): asserts this is this & { client: Client } {
    if (!this.client) throw new Error("Device not connected");

    const fwVersion = this.client.getFwVersion();

    if (fwVersion.major === 0 && fwVersion.minor < 14) {
      throw new Error(
        `Solana requires firmware >= 0.14.0, current: ${fwVersion.major}.${fwVersion.minor}.${fwVersion.fix}`
      );
    }
  }

  public async solanaGetAddress(msg: core.SolanaGetAddress): Promise<string | null> {
    this.assertSolanaFwSupport();
    return solana.solanaGetAddress(this.client, msg);
  }

  public async solanaSignTx(msg: core.SolanaSignTx): Promise<core.SolanaSignedTx | null> {
    this.assertSolanaFwSupport();
    return solana.solanaSignTx(this.client, msg);
  }

  public async cosmosGetAddress(msg: core.CosmosGetAddress): Promise<string | null> {
    if (!this.client) throw new Error("Device not connected");
    return cosmos.cosmosGetAddress(this.client, msg);
  }

  public async cosmosSignTx(msg: core.CosmosSignTx): Promise<core.CosmosSignedTx | null> {
    if (!this.client) throw new Error("Device not connected");
    return cosmos.cosmosSignTx(this.client, msg);
  }

  public async thorchainGetAddress(msg: core.ThorchainGetAddress): Promise<string | null> {
    if (!this.client) throw new Error("Device not connected");
    return thorchain.thorchainGetAddress(this.client, msg);
  }

  public async thorchainSignTx(msg: core.ThorchainSignTx): Promise<core.ThorchainSignedTx | null> {
    if (!this.client) throw new Error("Device not connected");
    return thorchain.thorchainSignTx(this.client, msg);
  }

  public async mayachainGetAddress(msg: core.MayachainGetAddress): Promise<string | null> {
    if (!this.client) throw new Error("Device not connected");
    return mayachain.mayachainGetAddress(this.client, msg);
  }

  public async mayachainSignTx(msg: core.MayachainSignTx): Promise<core.MayachainSignedTx | null> {
    if (!this.client) throw new Error("Device not connected");
    return mayachain.mayachainSignTx(this.client, msg);
  }
}
