import * as core from "@shapeshiftoss/hdwallet-core";

import { kavaTests as tests } from "./kava";

export function kavaTests(get: () => { wallet: core.KavaWallet & core.HDWallet; info: core.HDWalletInfo }): void {
  tests(get);
}
