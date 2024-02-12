import * as core from "@shapeshiftoss/hdwallet-core";
import {
  thorchainGetAddress as snapThorchainGetAddress,
  thorchainSignTransaction as snapThorchainSignTransaction,
} from "@shapeshiftoss/metamask-snaps-adapter";
import { ThorchainGetAddressResponse } from "@shapeshiftoss/metamask-snaps-types";

import { SNAP_ID } from "./common";

export function thorchainGetAccountPaths(msg: core.ThorchainGetAccountPaths): Array<core.ThorchainAccountPath> {
  return [
    {
      addressNList: [0x80000000 + 44, 0x80000000 + core.slip44ByCoin("Thorchain"), 0x80000000 + msg.accountIdx, 0, 0],
    },
  ];
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function thorchainNextAccountPath(msg: core.ThorchainAccountPath): core.ThorchainAccountPath | undefined {
  // Only support one account for now (like portis).
  return undefined;
}

export async function thorchainGetAddress(msg: core.ThorchainGetAddress): Promise<ThorchainGetAddressResponse> {
  return await snapThorchainGetAddress({ snapId: SNAP_ID, addressParams: { addressNList: msg.addressNList } });
}

export async function thorchainSignTx(msg: core.ThorchainSignTx): Promise<core.ThorchainSignedTx | null> {
  return await snapThorchainSignTransaction({ snapId: SNAP_ID, transaction: msg });
}
