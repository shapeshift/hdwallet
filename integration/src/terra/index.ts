import * as core from "@shapeshiftoss/hdwallet-core";

import { terraTests as tests } from "./terra";

export function terraTests(get: () => { wallet: core.HDWallet; info: core.HDWalletInfo }): void {
  tests(get);
}
