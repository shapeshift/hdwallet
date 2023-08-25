import * as core from "@shapeshiftoss/hdwallet-core";
import {
  osmosisGetAddress as snapOsmosisGetAddress,
  osmosisSignTransaction as snapOsmosisSignTransaction,
} from "@shapeshiftoss/shapeshift-multichain-adapter";

import { SNAP_ID } from "./common";

export function osmosisGetAccountPaths(msg: core.OsmosisGetAccountPaths): Array<core.OsmosisAccountPath> {
  return [
    {
      addressNList: [0x80000000 + 44, 0x80000000 + core.slip44ByCoin("Osmo"), 0x80000000 + msg.accountIdx, 0, 0],
    },
  ];
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function osmosisNextAccountPath(msg: core.OsmosisAccountPath): core.OsmosisAccountPath | undefined {
  // Only support one account for now (like portis).
  return undefined;
}

export async function osmosisGetAddress(msg: core.OsmosisGetAddress): Promise<string | null> {
  return await snapOsmosisGetAddress({ snapId: SNAP_ID, addressNList: msg.addressNList });
}

export async function osmosisSignTx(msg: core.OsmosisSignTx): Promise<core.OsmosisSignedTx | null> {
  return await snapOsmosisSignTransaction({ snapId: SNAP_ID, ...msg });
}
