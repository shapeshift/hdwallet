import { EosWallet, HDWallet, HDWalletInfo } from "@shapeshiftoss/hdwallet-core";

import { eosTests as tests } from "./eos";

export function eosTests(get: () => { wallet: EosWallet & HDWallet; info: HDWalletInfo }): void {
  tests(get);
}
