import * as core from "@shapeshiftoss/hdwallet-core";
import {
  dogecoinGetAddress as snapDogecoinGetAddress,
  dogecoinSignTransaction as snapDogecoinSignTransaction,
} from "@shapeshiftoss/shapeshift-multichain-adapter";

import { SNAP_ID } from "./common";
import { utxoGetAccountPaths } from "./utxo";

export function dogecoinGetAccountPaths(msg: core.BTCGetAccountPaths): Array<core.BTCAccountPath> {
  return utxoGetAccountPaths(msg);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function dogecoinNextAccountPath(msg: core.BTCAccountPath): core.BTCAccountPath | undefined {
  // Only support one account for now (like portis).
  return undefined;
}

export async function dogecoinGetAddress(msg: core.BTCGetAddress): Promise<string | null> {
  return await snapDogecoinGetAddress({ snapId: SNAP_ID, addressNList: msg.addressNList });
}

export async function dogecoinSignTx(msg: core.BTCSignTx): Promise<core.BTCSignedTx | null> {
  return await snapDogecoinSignTransaction({ snapId: SNAP_ID, ...msg });
}
