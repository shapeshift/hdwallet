import * as core from "@shapeshiftoss/hdwallet-core";

import { binanceTests as tests } from "./binance";

export function binanceTests(get: () => { wallet: core.HDWallet; info: core.HDWalletInfo }): void {
  tests(get);
}
