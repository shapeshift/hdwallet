import * as core from "@shapeshiftoss/hdwallet-core";
import {
  kavaGetAddress as snapKavaGetAddress,
  kavaSignTransaction as snapKavaSignTransaction,
} from "@shapeshiftoss/shapeshift-multichain-adapter";

import { SNAP_ID } from "./common";

export function kavaGetAccountPaths(msg: core.KavaGetAccountPaths): Array<core.KavaAccountPath> {
  return [
    {
      addressNList: [0x80000000 + 44, 0x80000000 + core.slip44ByCoin("Kava"), 0x80000000 + msg.accountIdx, 0, 0],
    },
  ];
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function kavaNextAccountPath(msg: core.KavaAccountPath): core.KavaAccountPath | undefined {
  // Only support one account for now (like portis).
  return undefined;
}

export async function kavaGetAddress(msg: core.KavaGetAddress): Promise<string | null> {
  return await snapKavaGetAddress({ snapId: SNAP_ID, addressNList: msg.addressNList });
}

export async function kavaSignTx(msg: core.KavaSignTx): Promise<core.KavaSignedTx | null> {
  return await snapKavaSignTransaction({ snapId: SNAP_ID, ...msg });
}
