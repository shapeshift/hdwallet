import * as core from "@shapeshiftoss/hdwallet-core";

import { bitcoinTests } from "./bitcoin";
import { litecoinTests } from "./litecoin";
import { testnetTests } from "./testnet";

export function btcTests(get: () => { wallet: core.HDWallet; info: core.HDWalletInfo }): void {
  bitcoinTests(get);
  testnetTests(get);
  litecoinTests(get);
}
