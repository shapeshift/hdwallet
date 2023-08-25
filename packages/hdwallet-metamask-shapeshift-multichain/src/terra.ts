import * as core from "@shapeshiftoss/hdwallet-core";
import {
  terraGetAddress as snapTerraGetAddress,
  terraSignTransaction as snapTerraSignTransaction,
} from "@shapeshiftoss/shapeshift-multichain-adapter";

import { SNAP_ID } from "./common";

export function terraGetAccountPaths(msg: core.TerraGetAccountPaths): Array<core.TerraAccountPath> {
  return [
    {
      addressNList: [0x80000000 + 44, 0x80000000 + core.slip44ByCoin("Terra"), 0x80000000 + msg.accountIdx, 0, 0],
    },
  ];
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function terraNextAccountPath(msg: core.TerraAccountPath): core.TerraAccountPath | undefined {
  // Only support one account for now (like portis).
  return undefined;
}

export async function terraGetAddress(msg: core.TerraGetAddress): Promise<string | null> {
  return await snapTerraGetAddress({ snapId: SNAP_ID, addressNList: msg.addressNList });
}

export async function terraSignTx(msg: core.TerraSignTx): Promise<core.TerraSignedTx | null> {
  return await snapTerraSignTransaction({ snapId: SNAP_ID, ...msg });
}
