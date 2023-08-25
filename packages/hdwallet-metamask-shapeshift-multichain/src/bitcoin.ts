import * as core from "@shapeshiftoss/hdwallet-core";
import {
  bitcoinGetAddress as snapBitcoinGetAddress,
  bitcoinSignTransaction as snapBitcoinSignTransaction,
} from "@shapeshiftoss/shapeshift-multichain-adapter";

import { SNAP_ID } from "./common";
import { utxoGetAccountPaths } from "./utxo";

export function bitcoinGetAccountPaths(msg: core.BTCGetAccountPaths): Array<core.BTCAccountPath> {
  return utxoGetAccountPaths(msg);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function bitcoinNextAccountPath(msg: core.BTCAccountPath): core.BTCAccountPath | undefined {
  // Only support one account for now (like portis).
  return undefined;
}

export async function bitcoinGetAddress(msg: core.BTCGetAddress): Promise<string | null> {
  return await snapBitcoinGetAddress({ snapId: SNAP_ID, addressNList: msg.addressNList });
}

export async function bitcoinSignTx(msg: core.BTCSignTx): Promise<core.BTCSignedTx | null> {
  return await snapBitcoinSignTransaction({ snapId: SNAP_ID, ...msg });
}
