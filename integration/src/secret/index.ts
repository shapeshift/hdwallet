import * as core from "@shapeshiftoss/hdwallet-core";

import { secretTests as tests } from "./secret";

export function secretTests(get: () => { wallet: core.HDWallet; info: core.HDWalletInfo }): void {
  tests(get);
}
