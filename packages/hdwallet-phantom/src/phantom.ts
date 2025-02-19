import * as core from "@shapeshiftoss/hdwallet-core";
import { BTCInputScriptType } from "@shapeshiftoss/hdwallet-core";
import Base64 from "base64-js";
import * as bitcoinMsg from "bitcoinjs-message";
import { keccak256, recoverAddress } from "ethers/lib/utils.js";
import isObject from "lodash/isObject";

import * as btc from "./bitcoin";
import * as eth from "./ethereum";
import { solanaSendTx, solanaSignTx } from "./solana";
import { PhantomEvmProvider, PhantomSolanaProvider, PhantomUtxoProvider } from "./types";

export function isPhantom(wallet: core.HDWallet): wallet is PhantomHDWallet {
  return isObject(wallet) && (wallet as any)._isPhantom;
}

export class PhantomHDWalletInfo
  implements core.HDWalletInfo, core.BTCWalletInfo, core.ETHWalletInfo, core.SolanaWalletInfo
{
  readonly _supportsBTCInfo = true;
  readonly _supportsETHInfo = true;
  readonly _supportsSolanaInfo = true;

  evmProvider: PhantomEvmProvider;

  constructor(evmProvider: PhantomEvmProvider) {
    this.evmProvider = evmProvider;
  }

  public getVendor(): string {
    return "Phantom";
  }

  public hasOnDevicePinEntry(): boolean {
    return false;
  }

  public hasOnDevicePassphrase(): boolean {
    return true;
  }

  public hasOnDeviceDisplay(): boolean {
    return true;
  }

  public hasOnDeviceRecovery(): boolean {
    return true;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public hasNativeShapeShift(srcCoin: core.Coin, dstCoin: core.Coin): boolean {
    return false;
  }

  public supportsBip44Accounts(): boolean {
    return false;
  }

  public supportsOfflineSigning(): boolean {
    return false;
  }

  public supportsBroadcast(): boolean {
    return true;
  }

  public describePath(msg: core.DescribePath): core.PathDescription {
    switch (msg.coin.toLowerCase()) {
      case "bitcoin": {
        const unknown = core.unknownUTXOPath(msg.path, msg.coin, msg.scriptType);

        if (!msg.scriptType) return unknown;
        if (!this.btcSupportsCoin(msg.coin)) return unknown;
        if (!this.btcSupportsScriptType(msg.coin, msg.scriptType)) return unknown;

        return core.describeUTXOPath(msg.path, msg.coin, msg.scriptType);
      }
      case "ethereum":
        return core.describeETHPath(msg.path);
      case "solana":
        return core.solanaDescribePath(msg.path);
      default:
        throw new Error("Unsupported path");
    }
  }

  /** Ethereum */

  public async ethSupportsNetwork(chainId: number): Promise<boolean> {
    return chainId === 1;
  }

  public async ethGetChainId(): Promise<number | null> {
    try {
      if (!this.evmProvider.request) throw new Error("Provider does not support ethereum.request");
      // chainId as hex string
      const chainId: string = await this.evmProvider.request({ method: "eth_chainId" });
      return parseInt(chainId, 16);
    } catch (e) {
      console.error(e);
      return null;
    }
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
    return eth.ethGetAccountPaths(msg);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public ethNextAccountPath(msg: core.ETHAccountPath): core.ETHAccountPath | undefined {
    console.error("Method not implemented");
    return undefined;
  }

  /** Bitcoin */

  public async btcSupportsCoin(coin: core.Coin): Promise<boolean> {
    return coin.toLowerCase() === "bitcoin";
  }

  public async btcSupportsScriptType(coin: string, scriptType?: core.BTCInputScriptType | undefined): Promise<boolean> {
    if (!this.btcSupportsCoin(coin)) return false;

    switch (scriptType) {
      case core.BTCInputScriptType.SpendWitness:
        return true;
      default:
        return false;
    }
  }

  public async btcSupportsSecureTransfer(): Promise<boolean> {
    return false;
  }

  public btcSupportsNativeShapeShift(): boolean {
    return false;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public btcGetAccountPaths(msg: core.BTCGetAccountPaths): Array<core.BTCAccountPath> {
    return btc.btcGetAccountPaths(msg);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public btcNextAccountPath(msg: core.BTCAccountPath): core.BTCAccountPath | undefined {
    throw new Error("Method not implemented");
  }

  /** Solana */

  public solanaGetAccountPaths(msg: core.SolanaGetAccountPaths): Array<core.SolanaAccountPath> {
    return core.solanaGetAccountPaths(msg);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public solanaNextAccountPath(msg: core.SolanaAccountPath): core.SolanaAccountPath | undefined {
    throw new Error("Method not implemented");
  }
}

export class PhantomHDWallet
  extends PhantomHDWalletInfo
  implements core.HDWallet, core.BTCWallet, core.ETHWallet, core.SolanaWallet
{
  readonly _supportsBTC = true;
  readonly _supportsETH = true;
  readonly _supportsEthSwitchChain = false;
  readonly _supportsAvalanche = false;
  readonly _supportsOptimism = false;
  // Polygon is technically supported but is acting up on the Phantom side of things atm
  // https://github.com/orgs/phantom/discussions/294
  readonly _supportsPolygon = false;
  readonly _supportsGnosis = false;
  readonly _supportsArbitrum = false;
  readonly _supportsArbitrumNova = false;
  readonly _supportsBase = false;
  readonly _supportsBSC = false;
  readonly _supportsSolana = true;
  readonly _isPhantom = true;

  evmProvider: PhantomEvmProvider;
  bitcoinProvider: PhantomUtxoProvider;
  solanaProvider: PhantomSolanaProvider;

  ethAddress?: string | null;

  constructor(
    evmProvider: PhantomEvmProvider,
    bitcoinProvider: PhantomUtxoProvider,
    solanaProvider: PhantomSolanaProvider
  ) {
    super(evmProvider);

    this.evmProvider = evmProvider;
    this.bitcoinProvider = bitcoinProvider;
    this.solanaProvider = solanaProvider;
  }

  public async getDeviceID(): Promise<string> {
    return "phantom:" + (await this.solanaGetAddress());
  }

  async getFeatures(): Promise<Record<string, any>> {
    return {};
  }

  public async getFirmwareVersion(): Promise<string> {
    return "phantom";
  }

  public async getModel(): Promise<string> {
    return "Phantom";
  }

  public async getLabel(): Promise<string> {
    return "Phantom";
  }

  public async isInitialized(): Promise<boolean> {
    return true;
  }

  public async isLocked(): Promise<boolean> {
    return !this.evmProvider._metamask.isUnlocked();
  }

  public async clearSession(): Promise<void> {}

  public async initialize(): Promise<void> {}

  public async ping(msg: core.Ping): Promise<core.Pong> {
    return { msg: msg.msg };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async sendPin(pin: string): Promise<void> {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async sendPassphrase(passphrase: string): Promise<void> {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async sendCharacter(charater: string): Promise<void> {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async sendWord(word: string): Promise<void> {}

  public async cancel(): Promise<void> {}

  public async wipe(): Promise<void> {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async reset(msg: core.ResetDevice): Promise<void> {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async recover(msg: core.RecoverDevice): Promise<void> {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async loadDevice(msg: core.LoadDevice): Promise<void> {}

  public async disconnect(): Promise<void> {}

  public async getPublicKeys(msg: Array<core.GetPublicKey>): Promise<Array<core.PublicKey | null>> {
    return await Promise.all(
      msg.map(async (getPublicKey) => {
        const { coin, scriptType } = getPublicKey;

        // Only p2wpkh effectively supported for now
        if (coin === "Bitcoin" && scriptType === BTCInputScriptType.SpendWitness) {
          // Note this is a pubKey, not an xpub, however phantom does not support utxo derivation,
          // so this functions as an account (xpub) for all intents and purposes
          const pubKey = await this.btcGetAddress({ coin: "Bitcoin" } as core.BTCGetAddress);
          return { xpub: pubKey } as core.PublicKey;
        }

        return null;
      })
    );
  }

  /** Ethereum */

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async ethGetAddress(_msg: core.ETHGetAddress): Promise<string | null> {
    if (this.ethAddress) {
      return this.ethAddress;
    }

    const address = await eth.ethGetAddress(this.evmProvider);

    if (address) {
      this.ethAddress = address;
      return address;
    } else {
      this.ethAddress = null;
      return null;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async ethSignTx(msg: core.ETHSignTx): Promise<core.ETHSignedTx | null> {
    console.error("Method not implemented");
    return null;
  }

  public async ethSendTx(msg: core.ETHSignTx): Promise<core.ETHTxHash | null> {
    const address = await this.ethGetAddress({ addressNList: [] });
    return address ? eth.ethSendTx(msg, this.evmProvider, address) : null;
  }

  public async ethSignMessage(msg: core.ETHSignMessage): Promise<core.ETHSignedMessage | null> {
    const address = await this.ethGetAddress({ addressNList: [] });
    return address ? eth.ethSignMessage(msg, this.evmProvider, address) : null;
  }

  async ethSignTypedData(msg: core.ETHSignTypedData): Promise<core.ETHSignedTypedData | null> {
    const address = await this.ethGetAddress({ addressNList: [] });
    return address ? eth.ethSignTypedData(msg, this.evmProvider, address) : null;
  }

  public async ethVerifyMessage(msg: core.ETHVerifyMessage): Promise<boolean | null> {
    if (!msg.signature.startsWith("0x")) msg.signature = `0x${msg.signature}`;
    const digest = keccak256(core.buildMessage(msg.message));
    return recoverAddress(digest, msg.signature) === msg.address;
  }

  /** Bitcoin */

  public async btcGetAddress(msg: core.BTCGetAddress): Promise<string | null> {
    const value = await (async () => {
      switch (msg.coin) {
        case "Bitcoin": {
          const accounts = await this.bitcoinProvider.requestAccounts();
          const paymentAddress = accounts.find((account) => account.purpose === "payment")?.address;

          return paymentAddress;
        }
        default:
          return null;
      }
    })();
    if (!value || typeof value !== "string") return null;

    return value;
  }

  public async btcSignTx(msg: core.BTCSignTx): Promise<core.BTCSignedTx | null> {
    const { coin } = msg;
    switch (coin) {
      case "Bitcoin":
        return btc.bitcoinSignTx(this, msg, this.bitcoinProvider);
      default:
        return null;
    }
  }

  public async btcSignMessage(msg: core.BTCSignMessage): Promise<core.BTCSignedMessage | null> {
    const { coin } = msg;
    switch (coin) {
      case "Bitcoin": {
        const address = await this.btcGetAddress({ coin } as core.BTCGetAddress);
        if (!address) throw new Error(`Could not get ${coin} address`);
        const message = new TextEncoder().encode(msg.message);

        const { signature } = await this.bitcoinProvider.signMessage(address, message);
        return { signature: core.toHexString(signature), address };
      }
      default:
        return null;
    }
  }

  public async btcVerifyMessage(msg: core.BTCVerifyMessage): Promise<boolean | null> {
    const signature = Base64.fromByteArray(core.fromHexString(msg.signature));
    return bitcoinMsg.verify(msg.message, msg.address, signature);
  }

  /** Solana */

  public async solanaGetAddress(): Promise<string | null> {
    const { publicKey } = await this.solanaProvider.connect();
    return publicKey.toString();
  }

  public async solanaSignTx(msg: core.SolanaSignTx): Promise<core.SolanaSignedTx | null> {
    const address = await this.solanaGetAddress();
    return address ? solanaSignTx(msg, this.solanaProvider, address) : null;
  }

  public async solanaSendTx(msg: core.SolanaSignTx): Promise<core.SolanaTxSignature | null> {
    const address = await this.solanaGetAddress();
    return address ? solanaSendTx(msg, this.solanaProvider, address) : null;
  }
}
