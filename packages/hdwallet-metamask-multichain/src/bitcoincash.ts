import * as core from "@shapeshiftoss/hdwallet-core";
import {
  BCHGetAddress as snapBitcoinCashGetAddress,
  BCHGetPublicKeys as snapBitcoinCashGetPublicKeys,
  BCHSignTransaction as snapBitcoinCashSignTransaction,
} from "@shapeshiftoss/metamask-snaps-adapter";
import { BitcoinCashGetAddressResponse, BitcoinGetPublicKeysResponse } from "@shapeshiftoss/metamask-snaps-types";

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

export async function bitcoinCashGetAddress(msg: core.BTCGetAddress): Promise<BitcoinCashGetAddressResponse> {
  return await snapBitcoinCashGetAddress({ snapId: SNAP_ID, addressParams: msg });
}

export async function bitcoinCashGetPublicKeys(msg: core.BTCGetAddress): Promise<BitcoinGetPublicKeysResponse> {
  return await snapBitcoinCashGetPublicKeys({ snapId: SNAP_ID, addressParams: msg });
}

export async function bitcoinCashSignTx(msg: core.BTCSignTx): Promise<core.BTCSignedTx | null> {
  return await snapBitcoinCashSignTransaction({ snapId: SNAP_ID, transaction: msg });
}
