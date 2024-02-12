import * as core from "@keepkey/hdwallet-core";

import { rippleTests as tests } from "./ripple";

export function rippleTests(get: () => { wallet: core.HDWallet; info: core.HDWalletInfo }): void {
  tests(get);
}
