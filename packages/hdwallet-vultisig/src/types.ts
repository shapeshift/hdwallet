import { OfflineSigner } from "@cosmjs/proto-signing";
import { PublicKey, VersionedTransaction } from "@solana/web3.js";
import { TransactionSignature } from "@solana/web3.js";
import { providers } from "ethers";

import { SolanaAccount } from "./solana";

export type VultisigRequestParams = {
  get_accounts: [];
  request_accounts: [];
};

type VultisigRequestReturn = {
  get_accounts: Promise<string[]>;
  request_accounts: Promise<string[]>;
};

type VultisigRequestMethod = keyof VultisigRequestParams;

export type VultisigRequestPayload<M extends VultisigRequestMethod> = {
  method: M;
  params: VultisigRequestParams[M];
};

export type VultisigEvmProvider = providers.ExternalProvider;

export type VultisigUtxoProvider = {
  request<M extends VultisigRequestMethod>(payload: VultisigRequestPayload<M>): Promise<VultisigRequestReturn[M]>;
  signPSBT(
    psbt: Uint8Array,
    {
      inputsToSign,
    }: {
      inputsToSign: {
        address: string;
        signingIndexes: number[];
        sigHash?: number;
      }[];
    },
    broadcast: boolean
  ): Promise<Uint8Array>;
};

export type VultisigSolanaProvider = providers.ExternalProvider & {
  publicKey?: PublicKey;
  connect(): Promise<SolanaAccount>;
  signTransaction(transaction: VersionedTransaction): Promise<VersionedTransaction>;
  signAndSendTransaction(transaction: VersionedTransaction): Promise<{ signature: TransactionSignature }>;
};

export type VultisigOfflineProvider = providers.ExternalProvider & {
  getOfflineSigner(chainId: string): OfflineSigner;
};

export type VultisigGetVault = {
  hexChainCode: string;
  isFastVault: boolean;
  name: string;
  publicKeyEcdsa: string;
  publicKeyEddsa: string;
  uid: string;
};
