import * as core from "@shapeshiftoss/hdwallet-core";
import {
  secretGetAddress as snapSecretGetAddress,
  secretSignTransaction as snapSecretSignTransaction,
} from "@shapeshiftoss/shapeshift-multichain-adapter";

import { SNAP_ID } from "./common";

export function secretGetAccountPaths(msg: core.SecretGetAccountPaths): Array<core.SecretAccountPath> {
  return [
    {
      addressNList: [0x80000000 + 44, 0x80000000 + core.slip44ByCoin("Secret"), 0x80000000 + msg.accountIdx, 0, 0],
    },
  ];
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function secretNextAccountPath(msg: core.SecretAccountPath): core.SecretAccountPath | undefined {
  // Only support one account for now (like portis).
  return undefined;
}

export async function secretGetAddress(msg: core.SecretGetAddress): Promise<string | null> {
  return await snapSecretGetAddress({ snapId: SNAP_ID, addressNList: msg.addressNList });
}

export async function secretSignTx(msg: core.SecretSignTx): Promise<core.SecretSignedTx | null> {
  return await snapSecretSignTransaction({ snapId: SNAP_ID, ...msg });
}
