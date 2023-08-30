import * as core from "@shapeshiftoss/hdwallet-core";
import {
  cosmosGetAddress as snapCosmosGetAddress,
  cosmosSignTransaction as snapCosmosSignTransaction,
} from "@shapeshiftoss/metamask-snaps-adapter";
import { CosmosGetAddressResponse } from "@shapeshiftoss/metamask-snaps-types";

import { SNAP_ID } from "./common";

export function cosmosGetAccountPaths(msg: core.CosmosGetAccountPaths): Array<core.CosmosAccountPath> {
  return [
    {
      addressNList: [0x80000000 + 44, 0x80000000 + core.slip44ByCoin("Atom"), 0x80000000 + msg.accountIdx, 0, 0],
    },
  ];
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function cosmosNextAccountPath(msg: core.CosmosAccountPath): core.CosmosAccountPath | undefined {
  // Only support one account for now (like portis).
  return undefined;
}

export async function cosmosGetAddress(msg: core.CosmosGetAddress): Promise<CosmosGetAddressResponse> {
  return await snapCosmosGetAddress({ snapId: SNAP_ID, addressParams: { addressNList: msg.addressNList } });
}

export async function cosmosSignTx(msg: core.CosmosSignTx): Promise<core.CosmosSignedTx | null> {
  return await snapCosmosSignTransaction({ snapId: SNAP_ID, transaction: msg });
}
