import { HDWallet, HDWalletInfo } from "@shapeshiftoss/hdwallet-core";

import { secretTests as tests } from "./secret";

export function secretTests(get: () => { wallet: HDWallet; info: HDWalletInfo }): void {
  tests(get);
}
