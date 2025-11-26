import * as core from "@shapeshiftoss/hdwallet-core";
import { Client, Constants } from "gridplus-sdk";
import isObject from "lodash/isObject";
import { zeroHash } from "viem";

import * as btc from "./bitcoin";
import * as cosmos from "./cosmos";
import * as eth from "./ethereum";
import * as mayachain from "./mayachain";
import * as solana from "./solana";
import * as thorchain from "./thorchain";

type SafeCardType = 'external' | 'internal';

const isEmptyWallet = (uid?: Buffer): boolean => !uid || `0x${uid.toString('hex')}` === zeroHash;

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
    core.BTCWallet,
    core.CosmosWallet,
    core.ETHWallet,
    core.MayachainWallet,
    core.SolanaWallet,
    core.ThorchainWallet
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

  readonly _isGridPlus = true;

  client: Client | undefined;
  private expectedActiveWalletId?: string;
  private expectedType?: SafeCardType;

  constructor(client: Client) {
    super();
    this.client = client;
  }

  public setExpectedActiveWalletId(activeWalletId: string, type?: SafeCardType): void {
    this.expectedActiveWalletId = activeWalletId;
    this.expectedType = type;
  }

  async cancel(): Promise<void> {}
  async clearSession(): Promise<void> {}
  async initialize(): Promise<void> {}
  async loadDevice(): Promise<void> {}
  async recover(): Promise<void> {}
  async reset(): Promise<void> {}
  async sendCharacter(): Promise<void> {}
  async sendPassphrase(): Promise<void> {}
  async sendPin(): Promise<void> {}
  async sendWord(): Promise<void> {}
  async wipe(): Promise<void> {}

  async getDeviceID(): Promise<string> {
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

  async getFirmwareVersion(): Promise<string> {
    if (!this.client) throw new Error("Device not connected");
    const { major, minor, fix } = this.client.getFwVersion();
    return `${major}.${minor}.${fix}`;
  }

  async getModel(): Promise<string> {
    return "Lattice1";
  }

  async getLabel(): Promise<string> {
    return "GridPlus Lattice1";
  }

  async isInitialized(): Promise<boolean> {
    return Boolean(this.client);
  }

  async isLocked(): Promise<boolean> {
    return false;
  }

  async ping(msg: core.Ping): Promise<core.Pong> {
    return { msg: msg.msg };
  }

  async disconnect(): Promise<void> {
    this.client = undefined;
  }

  async getActiveWalletId(): Promise<string | undefined> {
    if (!this.client) throw new Error("Device not connected");

    const { external, internal } = await this.client.fetchActiveWallet();

    if (!isEmptyWallet(external.uid)) return external.uid.toString("hex");
    if (!isEmptyWallet(internal.uid)) return internal.uid.toString("hex");
  }

  /**
   * Validate that the currently active wallet matches expectations
   * Fetches fresh wallet info from device and logs details
   * Throws if expectedUid is provided and doesn't match
   */
  public async validateActiveWallet(
    expectedActiveWalletId?: string,
    expectedType?: SafeCardType
  ): Promise<{
    activeWalletId: string;
    type: SafeCardType;
  }> {
    if (!this.client) {
      throw new Error("Device not connected");
    }

    const activeWallets = await this.client.fetchActiveWallet();

    // Determine active wallet type (external SafeCard takes priority)
    const type: SafeCardType = (() => {
      if (!isEmptyWallet(activeWallets.external?.uid)) return 'external';
      if (!isEmptyWallet(activeWallets.internal?.uid)) return 'internal';

      throw new Error("No active wallet found on device");
    })();

    const activeWallet = activeWallets[type];
    const activeWalletId = activeWallet.uid.toString("hex");

    // Validate against expected activeWalletId if provided
    if (expectedActiveWalletId && activeWalletId !== expectedActiveWalletId) {
      if (expectedType === 'internal') {
        throw new Error("Remove inserted SafeCard to access internal GridPlus wallet");
      }
      throw new Error("Active SafeCard doesn't match expected SafeCard");
    }

    return { activeWalletId, type };
  }

  async getPublicKeys(msg: Array<core.GetPublicKey>): Promise<Array<core.PublicKey | null>> {
    if (!this.client) throw new Error("Device not connected");

    const publicKeys: Array<core.PublicKey | null> = [];

    for (const getPublicKey of msg) {
      const { addressNList, curve, coin, scriptType } = getPublicKey;

      try {
        const flag = (() => {
          switch (curve) {
            // For UTXO chains (Bitcoin, Dogecoin), we need the xpub
            case "secp256k1":
              return Constants.GET_ADDR_FLAGS.SECP256K1_XPUB;
            // For Solana/ed25519 chains, we need the public key
            case "ed25519":
              return Constants.GET_ADDR_FLAGS.ED25519_PUB;
            default:
              throw new Error(`Unsupported curve: ${curve}`);
          }
        })();

        const addresses = await this.client!.getAddresses({
          startPath: addressNList,
          n: 1,
          flag,
        });

        if (!addresses.length) throw new Error("No public key returned from device");

        // addresses[0] contains either xpub string (for SECP256K1_XPUB) or pubkey hex (for ED25519_PUB)
        let xpub = typeof addresses[0] === "string" ? addresses[0] : Buffer.from(addresses[0]).toString("hex");

        // Convert xpub format for Dogecoin/Litecoin (GridPlus returns Bitcoin xpub format)
        if (coin && curve === "secp256k1") {
          const accountType = scriptType ? core.scriptTypeToAccountType[scriptType] : undefined;
          xpub = core.convertXpubVersion(xpub, accountType, coin);
        }

        publicKeys.push({ xpub });
      } catch (error) {
        publicKeys.push(null);
      }
    }

    return publicKeys;
  }

  async btcGetAddress(msg: core.BTCGetAddress): Promise<string | null> {
    if (!this.client) throw new Error("Device not connected");
    return btc.btcGetAddress(this.client!, msg);
  }

  async btcSignTx(msg: core.BTCSignTx): Promise<core.BTCSignedTx | null> {
    if (!this.client) throw new Error("Device not connected");
    if (this.expectedActiveWalletId) await this.validateActiveWallet(this.expectedActiveWalletId, this.expectedType);
    return btc.btcSignTx(this.client, msg);
  }

  async btcSignMessage(): Promise<core.BTCSignedMessage | null> {
    throw new Error("GridPlus BTC message signing not yet implemented");
  }

  async btcVerifyMessage(): Promise<boolean | null> {
    throw new Error("GridPlus BTC message verification not yet implemented");
  }

  async ethGetAddress(msg: core.ETHGetAddress): Promise<core.Address | null> {
    if (!this.client) throw new Error("Device not connected");
    return eth.ethGetAddress(this.client, msg);
  }

  async ethSignTx(msg: core.ETHSignTx): Promise<core.ETHSignedTx> {
    if (!this.client) throw new Error("Device not connected");
    if (this.expectedActiveWalletId) await this.validateActiveWallet(this.expectedActiveWalletId, this.expectedType);
    return eth.ethSignTx(this.client, msg);
  }

  async ethSignTypedData(msg: core.ETHSignTypedData): Promise<core.ETHSignedTypedData> {
    if (!this.client) throw new Error("Device not connected");
    if (this.expectedActiveWalletId) await this.validateActiveWallet(this.expectedActiveWalletId, this.expectedType);
    return eth.ethSignTypedData(this.client, msg);
  }

  async ethSignMessage(msg: core.ETHSignMessage): Promise<core.ETHSignedMessage> {
    if (!this.client) throw new Error("Device not connected");
    if (this.expectedActiveWalletId) await this.validateActiveWallet(this.expectedActiveWalletId, this.expectedType);
    return eth.ethSignMessage(this.client, msg);
  }

  async ethVerifyMessage(): Promise<boolean> {
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

  async solanaGetAddress(msg: core.SolanaGetAddress): Promise<string | null> {
    this.assertSolanaFwSupport();
    return solana.solanaGetAddress(this.client, msg);
  }

  async solanaSignTx(msg: core.SolanaSignTx): Promise<core.SolanaSignedTx | null> {
    this.assertSolanaFwSupport();
    if (this.expectedActiveWalletId) await this.validateActiveWallet(this.expectedActiveWalletId, this.expectedType);
    return solana.solanaSignTx(this.client, msg);
  }

  async cosmosGetAddress(msg: core.CosmosGetAddress): Promise<string | null> {
    if (!this.client) throw new Error("Device not connected");
    return cosmos.cosmosGetAddress(this.client, msg);
  }

  async cosmosSignTx(msg: core.CosmosSignTx): Promise<core.CosmosSignedTx | null> {
    if (!this.client) throw new Error("Device not connected");
    if (this.expectedActiveWalletId) await this.validateActiveWallet(this.expectedActiveWalletId, this.expectedType);
    return cosmos.cosmosSignTx(this.client, msg);
  }

  async thorchainGetAddress(msg: core.ThorchainGetAddress): Promise<string | null> {
    if (!this.client) throw new Error("Device not connected");
    return thorchain.thorchainGetAddress(this.client, msg);
  }

  async thorchainSignTx(msg: core.ThorchainSignTx): Promise<core.ThorchainSignedTx | null> {
    if (!this.client) throw new Error("Device not connected");
    if (this.expectedActiveWalletId) await this.validateActiveWallet(this.expectedActiveWalletId, this.expectedType);
    return thorchain.thorchainSignTx(this.client, msg);
  }

  async mayachainGetAddress(msg: core.MayachainGetAddress): Promise<string | null> {
    if (!this.client) throw new Error("Device not connected");
    return mayachain.mayachainGetAddress(this.client, msg);
  }

  async mayachainSignTx(msg: core.MayachainSignTx): Promise<core.MayachainSignedTx | null> {
    if (!this.client) throw new Error("Device not connected");
    if (this.expectedActiveWalletId) await this.validateActiveWallet(this.expectedActiveWalletId, this.expectedType);
    return mayachain.mayachainSignTx(this.client, msg);
  }
}
