import * as core from "@shapeshiftoss/hdwallet-core";
import { PublicKey } from "@shapeshiftoss/hdwallet-core";
import {
  dogecoinGetAddress as snapDogecoinGetAddress,
  dogecoinGetPublicKeys as snapDogecoinGetPublicKeys,
  dogecoinSignTransaction as snapDogecoinSignTransaction,
} from "@shapeshiftoss/metamask-snaps-adapter";

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
  return await snapDogecoinGetAddress({ snapId: SNAP_ID, addressParams: msg });
}

export async function dogecoinGetPublicKeys(msg: core.BTCGetAddress): Promise<Array<PublicKey | null>> {
  return await snapDogecoinGetPublicKeys({ snapId: SNAP_ID, addressParams: msg });
}

export async function dogecoinSignTx(msg: core.BTCSignTx): Promise<core.BTCSignedTx | null> {
  return await snapDogecoinSignTransaction({ snapId: SNAP_ID, transaction: msg });
}
