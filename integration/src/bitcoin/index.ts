import * as core from "@shapeshiftoss/hdwallet-core";

import { bitcoinTests } from "./bitcoin";
import { testnetTests } from "./testnet";
import { litecoinTests } from "./litecoin";

export function btcTests(get: () => { wallet: core.HDWallet; info: core.HDWalletInfo }): void {
  bitcoinTests(get);
  testnetTests(get);
  litecoinTests(get);
}
