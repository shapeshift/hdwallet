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

const ATOM_CHAIN = "cosmoshub-4";

export function cosmosGetAccountPaths(msg: CosmosGetAccountPaths): Array<CosmosAccountPath> {
  return [
    {
      addressNList: [0x80000000 + 44, 0x80000000 + slip44ByCoin("Atom"), 0x80000000 + msg.accountIdx, 0, 0],
    },
  ];
}

export async function cosmosGetAddress(provider: VultisigOfflineProvider): Promise<string | undefined> {
  const offlineSigner = provider.getOfflineSigner(ATOM_CHAIN);
  const accounts = await offlineSigner.getAccounts();
  return accounts[0].address;
}

export async function cosmosSignTx(provider: VultisigOfflineProvider, msg: CosmosSignTx): Promise<CosmosSignedTx> {
  const offlineSigner = provider.getOfflineSigner(ATOM_CHAIN);

  const address = await cosmosGetAddress(provider);
  if (!address) throw new Error("failed to get address");

  const signerData: SignerData = {
    sequence: Number(msg.sequence),
    accountNumber: Number(msg.account_number),
    chainId: msg.chain_id,
  };

  return await sign(address, msg.tx as StdTx, offlineSigner, signerData, "cosmos");
}
