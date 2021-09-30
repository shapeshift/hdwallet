import * as core from "@shapeshiftoss/hdwallet-core";

import tx_unsigned from "./tx03.cosmoshub4.json";
import tx_signed from "./tx03.cosmoshub4.signed.json";
import tx_signed_deposit from "./tx01.mainnet.cosmos.ibc.depsosit.json";
import tx_signed_withdrawal from "./tx01.mainnet.cosmos.ibc.withdrawal.json";

const MNEMONIC12_NOPIN_NOPASSPHRASE = "alcohol woman abuse must during monitor noble actual mixed trade anger aisle";

const TIMEOUT = 60 * 1000;

/**
 *  Main integration suite for testing CosmosWallet implementations' Cosmos support.
 */
export function cosmosTests(get: () => { wallet: core.HDWallet; info: core.HDWalletInfo }): void {
  let wallet: core.CosmosWallet & core.HDWallet;

  describe("Cosmos", () => {
    beforeAll(async () => {
      const { wallet: w } = get();
      if (core.supportsCosmos(w)) wallet = w;
    });

    beforeEach(async () => {
      if (!wallet) return;
      await wallet.wipe();
      await wallet.loadDevice({
        mnemonic: MNEMONIC12_NOPIN_NOPASSPHRASE,
        label: "test",
        skipChecksum: true,
      });
    }, TIMEOUT);

    test(
      "cosmosGetAccountPaths()",
      () => {
        if (!wallet) return;
        const paths = wallet.cosmosGetAccountPaths({ accountIdx: 0 });
        expect(paths.length > 0).toBe(true);
        expect(paths[0].addressNList[0] > 0x80000000).toBe(true);
      },
      TIMEOUT
    );

    test(
      "cosmosGetAddress()",
      async () => {
        if (!wallet) return;
        expect(
          await wallet.cosmosGetAddress({
            addressNList: core.bip32ToAddressNList("m/44'/118'/0'/0/0"),
            showDisplay: false,
          })
        ).toEqual("cosmos15cenya0tr7nm3tz2wn3h3zwkht2rxrq7q7h3dj");
      },
      TIMEOUT
    );

  });
}
