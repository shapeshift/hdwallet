import * as core from "@keepkey/hdwallet-core";

import { cosmosTests as tests } from "./cosmos";

export function cosmosTests(get: () => { wallet: core.HDWallet; info: core.HDWalletInfo }): void {
  tests(get);
}
