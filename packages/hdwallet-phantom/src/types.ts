import { PublicKey, TransactionSignature, VersionedTransaction } from "@solana/web3.js";
import { providers } from "ethers";

import { BtcAccount } from "./bitcoin";
import { SolanaAccount } from "./solana";

export type PhantomEvmProvider = providers.ExternalProvider & {
  _metamask: {
    isUnlocked: () => boolean;
  };
  request: (args: { method: string; params?: any[] }) => Promise<any>;
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

export type PhantomSuiProvider = providers.ExternalProvider & {
  publicKey?: string;
  connect(): Promise<{ publicKey: string }>;
  signAndExecuteTransaction(input: { transactionBlockSerialized: string }): Promise<{
    signature: string;
    bytes: string;
  }>;
  signPersonalMessage(message: Uint8Array): Promise<{ signature: string }>;
};
