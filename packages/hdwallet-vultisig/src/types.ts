import { PublicKey, VersionedTransaction } from "@solana/web3.js";
import { providers } from "ethers";

import { BtcAccount } from "./bitcoin";
import { SolanaAccount } from "./solana";

type VultisigRequestParams = {
  get_accounts: [];
};

type VultisigRequestReturn = {
  get_accounts: Promise<BtcAccount[] | string[]>;
  request_accounts: Promise<BtcAccount[]>;
};

type VultisigRequestMethod = keyof VultisigRequestParams;

type VultisigRequestPayload<M extends VultisigRequestMethod> = {
  method: M;
  params: VultisigRequestParams[M];
};

export type VultisigEvmProvider = providers.ExternalProvider & {
  _metamask: {
    isUnlocked: () => boolean;
  };
};

export type VultisigUtxoProvider = providers.ExternalProvider & {
  request<M extends VultisigRequestMethod>(payload: VultisigRequestPayload<M>): Promise<VultisigRequestReturn[M]>;
};

export type VultisigSolanaProvider = providers.ExternalProvider & {
  publicKey?: PublicKey;
  connect(): Promise<SolanaAccount>;
  signTransaction(transaction: VersionedTransaction): Promise<VersionedTransaction>;
  signAndSendTransaction(transaction: VersionedTransaction): Promise<{ signature: any }>;
};

export type VultisigBftProvider = any; // TODO: Keplr
