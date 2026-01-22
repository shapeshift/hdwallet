import type { VersionedTransaction } from "@solana/web3.js";

/**
 * App identity for Mobile Wallet Adapter authorization
 */
export interface SeekerAppIdentity {
  name: string;
  uri: string;
  icon: string;
}

/**
 * Authorization result from MWA wallet
 */
export interface SeekerAuthorizationResult {
  accounts: Array<{
    address: string;
    label?: string;
    publicKey: Uint8Array;
  }>;
  authToken: string;
  walletUriBase?: string;
}

/**
 * Provider interface for Seeker wallet operations
 * This abstracts the MWA transact function for testability
 */
export interface SeekerProvider {
  authorize(identity: SeekerAppIdentity, cluster: string): Promise<SeekerAuthorizationResult>;
  deauthorize(authToken: string): Promise<void>;
  signTransactions(transactions: VersionedTransaction[]): Promise<VersionedTransaction[]>;
  signAndSendTransactions(transactions: VersionedTransaction[]): Promise<string[]>;
}

/**
 * Configuration options for Seeker adapter
 */
export interface SeekerAdapterConfig {
  appIdentity: SeekerAppIdentity;
  cluster?: "solana:mainnet" | "solana:devnet" | "solana:testnet";
}
