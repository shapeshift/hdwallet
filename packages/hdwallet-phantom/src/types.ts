import { PublicKey, TransactionSignature, VersionedTransaction } from "@solana/web3.js";
import { providers } from "ethers";

import { BtcAccount } from "./bitcoin";
import { SolanaAccount } from "./solana";

export type PhantomEvmProvider = providers.ExternalProvider & {
  _metamask: {
    isUnlocked: () => boolean;
  };
  request: (args: { method: string; params?: unknown[] | object }) => Promise<unknown>;
};

export type PhantomUtxoProvider = providers.ExternalProvider & {
  requestAccounts: () => Promise<BtcAccount[]>;
  signMessage: (
    address: string,
    message: Uint8Array
  ) => Promise<{
    signature: Uint8Array;
  }>;
  signPSBT(
    psbt: Uint8Array,
    options: { inputsToSign: { sigHash?: number | undefined; address: string; signingIndexes: number[] }[] }
  ): Promise<Uint8Array>;
};

export type PhantomSolanaProvider = providers.ExternalProvider & {
  publicKey?: PublicKey;
  connect(): Promise<SolanaAccount>;
  signTransaction(transaction: VersionedTransaction): Promise<VersionedTransaction>;
  signAndSendTransaction(transaction: VersionedTransaction): Promise<{ signature: TransactionSignature }>;
};

export type PhantomSuiProvider = {
  requestAccount(): Promise<{ address: string; publicKey: Uint8Array }>;
  signMessage(message: Uint8Array, encoding?: string): Promise<{ signature: string }>;
  signTransaction(params: { transaction: string; address: string; networkID: string }): Promise<{ signature: string }>;
};
