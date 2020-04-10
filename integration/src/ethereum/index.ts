import { HDWallet, HDWalletInfo } from "@bithighlander/hdwallet-core";

import { ethereumTests } from "./ethereum";

export function ethTests(
  get: () => { wallet: HDWallet; info: HDWalletInfo }
): void {
  ethereumTests(get);
}
