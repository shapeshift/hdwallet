import * as core from "@shapeshiftoss/hdwallet-core";
import {
  LTCGetAddress as snapLitecoinGetAddress,
  LTCGetPublicKeys as snapLitecoinGetPublicKeys,
  LTCSignTransaction as snapLitecoinSignTransaction,
} from "@shapeshiftoss/metamask-snaps-adapter";
import { BitcoinGetPublicKeysResponse, LitecoinGetAddressResponse } from "@shapeshiftoss/metamask-snaps-types";

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

export async function litecoinGetAddress(msg: core.BTCGetAddress): Promise<LitecoinGetAddressResponse> {
  return await snapLitecoinGetAddress({ snapId: SNAP_ID, addressParams: msg });
}
export async function litecoinGetPublicKeys(msg: core.BTCGetAddress): Promise<BitcoinGetPublicKeysResponse> {
  return await snapLitecoinGetPublicKeys({ snapId: SNAP_ID, addressParams: msg });
}

export async function litecoinSignTx(msg: core.BTCSignTx): Promise<core.BTCSignedTx | null> {
  return await snapLitecoinSignTransaction({ snapId: SNAP_ID, transaction: msg });
}
