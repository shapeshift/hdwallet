import { HDWallet, HDWalletInfo } from "@bithighlander/hdwallet-core";

import { cosmosTests as tests } from "./cosmos";

export function cosmosTests(
  get: () => { wallet: HDWallet; info: HDWalletInfo }
): void {
  tests(get);
}
