import * as core from "@shapeshiftoss/hdwallet-core";
import {
  bitcoinCashGetAddress as snapBitcoinCashGetAddress,
  bitcoinCashSignTransaction as snapBitcoinCashSignTransaction,
} from "@shapeshiftoss/shapeshift-multichain-adapter";

import { SNAP_ID } from "./common";
import { utxoGetAccountPaths } from "./utxo";

export function bitcoinCashGetAccountPaths(msg: core.BTCGetAccountPaths): Array<core.BTCAccountPath> {
  return utxoGetAccountPaths(msg);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function bitcoinCashNextAccountPath(msg: core.BTCAccountPath): core.BTCAccountPath | undefined {
  // Only support one account for now (like portis).
  return undefined;
}

export async function bitcoinCashGetAddress(msg: core.BTCGetAddress): Promise<string | null> {
  return await snapBitcoinCashGetAddress({ snapId: SNAP_ID, addressNList: msg.addressNList });
}

export async function bitcoinCashSignTx(msg: core.BTCSignTx): Promise<core.BTCSignedTx | null> {
  return await snapBitcoinCashSignTransaction({ snapId: SNAP_ID, ...msg });
}
