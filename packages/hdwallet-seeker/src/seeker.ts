import * as core from "@shapeshiftoss/hdwallet-core";
import isObject from "lodash/isObject";

import { solanaSendTx, solanaSignTx } from "./solana";
import type { SeekerAuthorizationResult, SeekerProvider } from "./types";

export function isSeeker(wallet: core.HDWallet): wallet is SeekerHDWallet {
  return isObject(wallet) && (wallet as any)._isSeeker;
}

export class SeekerHDWalletInfo implements core.HDWalletInfo, core.SolanaWalletInfo {
  readonly _supportsSolanaInfo = true;

  public getVendor(): string {
    return "Seeker";
  }

  public hasOnDevicePinEntry(): boolean {
    return true; // Seeker has on-device authentication
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

  public hasNativeShapeShift(): boolean {
    return false;
  }

  public supportsBip44Accounts(): boolean {
    return true;
  }

  public supportsOfflineSigning(): boolean {
    return false;
  }

  public supportsBroadcast(): boolean {
    return true;
  }

  public describePath(msg: core.DescribePath): core.PathDescription {
    if (msg.coin.toLowerCase() === "solana") {
      return core.solanaDescribePath(msg.path);
    }
    throw new Error("Unsupported path - Seeker only supports Solana");
  }

  /** Solana */

  public solanaGetAccountPaths(msg: core.SolanaGetAccountPaths): Array<core.SolanaAccountPath> {
    return core.solanaGetAccountPaths(msg);
  }

  public solanaNextAccountPath(msg: core.SolanaAccountPath): core.SolanaAccountPath | undefined {
    // Only one account path supported per authorization
    return undefined;
  }
}

export class SeekerHDWallet extends SeekerHDWalletInfo implements core.HDWallet, core.SolanaWallet {
  readonly _supportsSolana = true;
  readonly _isSeeker = true;

  // Seeker is Solana-only
  readonly _supportsBTC = false;
  readonly _supportsETH = false;
  readonly _supportsEthSwitchChain = false;
  readonly _supportsAvalanche = false;
  readonly _supportsOptimism = false;
  readonly _supportsPolygon = false;
  readonly _supportsGnosis = false;
  readonly _supportsArbitrum = false;
  readonly _supportsArbitrumNova = false;
  readonly _supportsBase = false;
  readonly _supportsBSC = false;

  private provider: SeekerProvider;
  private authResult: SeekerAuthorizationResult;
  private solanaAddress: string | null = null;

  constructor(provider: SeekerProvider, authResult: SeekerAuthorizationResult) {
    super();
    this.provider = provider;
    this.authResult = authResult;
  }

  public async getDeviceID(): Promise<string> {
    const address = await this.solanaGetAddress({ addressNList: [] });
    return `seeker:${address}`;
  }

  public async getFirmwareVersion(): Promise<string> {
    return "seeker";
  }

  public async getModel(): Promise<string> {
    return "Seeker";
  }

  public async getLabel(): Promise<string> {
    return this.authResult.accounts[0]?.label ?? "Seeker Wallet";
  }

  public async isInitialized(): Promise<boolean> {
    return true;
  }

  public async isLocked(): Promise<boolean> {
    return false; // MWA handles locking at the wallet app level
  }

  public async clearSession(): Promise<void> {
    if (this.authResult.authToken) {
      try {
        await this.provider.deauthorize(this.authResult.authToken);
      } catch (error) {
        console.warn("Failed to deauthorize Seeker wallet:", error);
      }
    }
  }

  public async initialize(): Promise<void> {
    // Cache the primary account address
    if (this.authResult.accounts.length > 0) {
      this.solanaAddress = this.authResult.accounts[0].address;
    }
  }

  public async ping(msg: core.Ping): Promise<core.Pong> {
    return { msg: msg.msg };
  }

  public async sendPin(): Promise<void> {
    // Not applicable - Seeker handles PIN on device
  }

  public async sendPassphrase(): Promise<void> {
    // Not applicable - Seeker handles passphrase on device
  }

  public async sendCharacter(): Promise<void> {
    // Not applicable
  }

  public async sendWord(): Promise<void> {
    // Not applicable
  }

  public async cancel(): Promise<void> {
    // MWA sessions are atomic, no cancel needed
  }

  public async wipe(): Promise<void> {
    // Cannot wipe Seeker from external app
    throw new Error("Cannot wipe Seeker device from external application");
  }

  public async reset(): Promise<void> {
    // Cannot reset Seeker from external app
    throw new Error("Cannot reset Seeker device from external application");
  }

  public async recover(): Promise<void> {
    // Cannot trigger recovery from external app
    throw new Error("Cannot trigger recovery on Seeker device from external application");
  }

  public async loadDevice(): Promise<void> {
    // Cannot load device from external app
    throw new Error("Cannot load device on Seeker from external application");
  }

  public async disconnect(): Promise<void> {
    await this.clearSession();
  }

  public async getFeatures(): Promise<Record<string, any>> {
    return {
      vendor: "Seeker",
      model: "Seeker",
      supportsSolana: true,
    };
  }

  public async getPublicKeys(msg: Array<core.GetPublicKey>): Promise<Array<core.PublicKey | null>> {
    return msg.map((getPublicKey) => {
      if (getPublicKey.coin === "Solana" && this.authResult.accounts[0]) {
        return { xpub: this.authResult.accounts[0].address } as core.PublicKey;
      }
      return null;
    });
  }

  /** Solana */

  public async solanaGetAddress(msg: core.SolanaGetAddress): Promise<string | null> {
    // Return cached address from authorization
    if (this.solanaAddress) return this.solanaAddress;

    // If no cached address, return from auth result
    if (this.authResult.accounts.length > 0) {
      this.solanaAddress = this.authResult.accounts[0].address;
      return this.solanaAddress;
    }

    return null;
  }

  public async solanaSignTx(msg: core.SolanaSignTx): Promise<core.SolanaSignedTx | null> {
    const address = await this.solanaGetAddress({ addressNList: msg.addressNList });
    if (!address) {
      throw new Error("No Solana address available");
    }
    return solanaSignTx(msg, this.provider, address);
  }

  public async solanaSendTx(msg: core.SolanaSignTx): Promise<core.SolanaTxSignature | null> {
    const address = await this.solanaGetAddress({ addressNList: msg.addressNList });
    if (!address) {
      throw new Error("No Solana address available");
    }
    return solanaSendTx(msg, this.provider, address);
  }
}
