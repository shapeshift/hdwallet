import * as core from "@shapeshiftoss/hdwallet-core";
import {
  binanceGetAddress as snapBinanceGetAddress,
  binanceSignTransaction as snapBinanceSignTransaction,
} from "@shapeshiftoss/shapeshift-multichain-adapter";

import { SNAP_ID } from "./common";

export function binanceGetAccountPaths(msg: core.BinanceGetAccountPaths): Array<core.BinanceAccountPath> {
  return [
    {
      addressNList: [0x80000000 + 44, 0x80000000 + core.slip44ByCoin("Binance"), 0x80000000 + msg.accountIdx, 0, 0],
    },
  ];
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function binanceNextAccountPath(msg: core.BinanceAccountPath): core.BinanceAccountPath | undefined {
  // Only support one account for now (like portis).
  return undefined;
}

export async function binanceGetAddress(msg: core.BinanceGetAddress): Promise<string | null> {
  return await snapBinanceGetAddress({ snapId: SNAP_ID, addressNList: msg.addressNList });
}

export async function binanceSignTx(msg: core.BinanceSignTx): Promise<core.BinanceSignedTx | null> {
  return await snapBinanceSignTransaction({ snapId: SNAP_ID, ...msg });
}
