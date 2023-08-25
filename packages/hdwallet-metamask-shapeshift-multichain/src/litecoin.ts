import * as core from "@shapeshiftoss/hdwallet-core";
import {
  litecoinGetAddress as snapLitecoinGetAddress,
  litecoinSignTransaction as snapLitecoinSignTransaction,
} from "@shapeshiftoss/shapeshift-multichain-adapter";

import { SNAP_ID } from "./common";
import { utxoGetAccountPaths } from "./utxo";

export function litecoinGetAccountPaths(msg: core.BTCGetAccountPaths): Array<core.BTCAccountPath> {
  return utxoGetAccountPaths(msg);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function litecoinNextAccountPath(msg: core.BTCAccountPath): core.BTCAccountPath | undefined {
  // Only support one account for now (like portis).
  return undefined;
}

export async function litecoinGetAddress(msg: core.BTCGetAddress): Promise<string | null> {
  return await snapLitecoinGetAddress({ snapId: SNAP_ID, addressNList: msg.addressNList });
}

export async function litecoinSignTx(msg: core.BTCSignTx): Promise<core.BTCSignedTx | null> {
  return await snapLitecoinSignTransaction({ snapId: SNAP_ID, ...msg });
}
