import * as core from "@shapeshiftoss/hdwallet-core";

import { SeekerHDWallet } from "./seeker";
import type { SeekerAdapterConfig, SeekerAuthorizationResult, SeekerProvider } from "./types";

/**
 * Creates a Seeker provider that wraps the Mobile Wallet Adapter transact function
 * 
 * NOTE: This implementation requires the @solana-mobile/mobile-wallet-adapter-protocol-web3js
 * package and is designed for React Native environments. For web environments, consider
 * using WalletConnect V2 which already supports Solana-compatible wallets.
 */
async function createSeekerProvider(config: SeekerAdapterConfig): Promise<SeekerProvider> {
  // Dynamic import to support environments where MWA is not available
  const { transact } = await import("@solana-mobile/mobile-wallet-adapter-protocol-web3js");

  let cachedAuthResult: SeekerAuthorizationResult | null = null;

  return {
    async authorize(identity, cluster) {
      const result = await transact(async (wallet) => {
        const authResult = await wallet.authorize({
          chain: cluster,
          identity: {
            name: identity.name,
            uri: identity.uri,
            icon: identity.icon,
          },
        });

        return {
          accounts: authResult.accounts.map((account) => ({
            address: account.address,
            label: account.label,
            publicKey: new Uint8Array(Buffer.from(account.address, "base64")),
          })),
          authToken: authResult.auth_token,
          walletUriBase: authResult.wallet_uri_base,
        };
      });

      cachedAuthResult = result;
      return result;
    },

    async deauthorize(authToken) {
      await transact(async (wallet) => {
        await wallet.deauthorize({ auth_token: authToken });
      });
      cachedAuthResult = null;
    },

    async signTransactions(transactions) {
      return transact(async (wallet) => {
        // Re-authorize if needed using cached auth token
        if (cachedAuthResult?.authToken) {
          await wallet.authorize({
            chain: config.cluster ?? "solana:mainnet",
            identity: config.appIdentity,
            auth_token: cachedAuthResult.authToken,
          });
        }

        const signedTxs = await wallet.signTransactions({
          transactions,
        });

        return signedTxs;
      });
    },

    async signAndSendTransactions(transactions) {
      return transact(async (wallet) => {
        // Re-authorize if needed using cached auth token
        if (cachedAuthResult?.authToken) {
          await wallet.authorize({
            chain: config.cluster ?? "solana:mainnet",
            identity: config.appIdentity,
            auth_token: cachedAuthResult.authToken,
          });
        }

        const signatures = await wallet.signAndSendTransactions({
          transactions,
        });

        return signatures;
      });
    },
  };
}

export class SeekerAdapter {
  keyring: core.Keyring;
  private config: SeekerAdapterConfig;

  private constructor(keyring: core.Keyring, config: SeekerAdapterConfig) {
    this.keyring = keyring;
    this.config = config;
  }

  public static useKeyring(keyring: core.Keyring, config: SeekerAdapterConfig) {
    return new SeekerAdapter(keyring, config);
  }

  public async initialize(): Promise<number> {
    return Object.keys(this.keyring.wallets).length;
  }

  public async pairDevice(): Promise<SeekerHDWallet | undefined> {
    try {
      const provider = await createSeekerProvider(this.config);

      // Authorize with the wallet
      const authResult = await provider.authorize(
        this.config.appIdentity,
        this.config.cluster ?? "solana:mainnet"
      );

      if (!authResult.accounts.length) {
        throw new Error("No accounts returned from Seeker wallet authorization");
      }

      const wallet = new SeekerHDWallet(provider, authResult);
      await wallet.initialize();

      const deviceID = await wallet.getDeviceID();
      this.keyring.add(wallet, deviceID);
      this.keyring.emit(["Seeker", deviceID, core.Events.CONNECT], deviceID);

      return wallet;
    } catch (error) {
      console.error("Failed to pair Seeker wallet:", error);
      throw error;
    }
  }
}
