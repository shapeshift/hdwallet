import * as core from "@shapeshiftoss/hdwallet-core";

import { mayachainTests as tests } from "./mayachain";

export function mayachainTests(get: () => { wallet: core.HDWallet; info: core.HDWalletInfo }): void {
  tests(get);
}
