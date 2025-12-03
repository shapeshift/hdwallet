import { StdTx } from "@cosmjs/amino";
import { SignerData } from "@cosmjs/stargate";
import {
  CosmosAccountPath,
  CosmosGetAccountPaths,
  CosmosSignedTx,
  CosmosSignTx,
  slip44ByCoin,
} from "@shapeshiftoss/hdwallet-core";
import { sign } from "@shapeshiftoss/proto-tx-builder";

import { VultisigOfflineProvider } from "./types";

export function thorchainGetAccountPaths(msg: CosmosGetAccountPaths): Array<CosmosAccountPath> {
  return [
    {
      addressNList: [0x80000000 + 44, 0x80000000 + slip44ByCoin("Thorchain"), 0x80000000 + msg.accountIdx, 0, 0],
    },
  ];
}

export async function thorchainGetAddress(provider: VultisigOfflineProvider): Promise<string | undefined> {
  const offlineSigner = provider.getOfflineSigner("thorchain-1");
  const accounts = await offlineSigner.getAccounts();
  return accounts[0].address;
}

export async function thorchainSignTx(provider: VultisigOfflineProvider, msg: CosmosSignTx): Promise<CosmosSignedTx> {
  const offlineSigner = provider.getOfflineSigner(msg.chain_id);

  const address = await thorchainGetAddress(provider);
  if (!address) throw new Error("failed to get address");

  const signerData: SignerData = {
    sequence: Number(msg.sequence),
    accountNumber: Number(msg.account_number),
    chainId: msg.chain_id,
  };

  const result = await sign(address, msg.tx as StdTx, offlineSigner, signerData, "thor");

  return result;
}
