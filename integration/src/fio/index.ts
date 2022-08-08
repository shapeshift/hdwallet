import * as core from "@shapeshiftoss/hdwallet-core";

import { fioTests as tests } from "./fio";

export function fioTests(
  get: () => {
    wallet: core.FioWallet & core.HDWallet;
    info: core.HDWalletInfo;
    wallet2: core.FioWallet & core.HDWallet;
  }
): void {
  tests(get);
}
