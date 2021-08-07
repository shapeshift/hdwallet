import * as core from "@shapeshiftoss/hdwallet-core";

import { osmosisTests as tests } from "./osmosis";

export function cosmosTests(get: () => { wallet: core.HDWallet; info: core.HDWalletInfo }): void {
  tests(get);
}
