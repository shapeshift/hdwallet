import * as core from "@shapeshiftoss/hdwallet-core";

import { rippleTests as tests } from "./ripple";

export function rippleTests(get: () => { wallet: core.RippleWallet & core.HDWallet; info: core.HDWalletInfo }): void {
  tests(get);
}
