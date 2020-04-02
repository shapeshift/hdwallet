import {
  bip32ToAddressNList,
  HDWallet,
  CosmosWallet,
  supportsCosmos,
  CosmosTx,
} from "@shapeshiftoss/hdwallet-core";
import { HDWalletInfo } from "@shapeshiftoss/hdwallet-core/src/wallet";

import * as tx01_unsigned from "./tx01.unsigned.json";
import * as tx01_signed from "./tx01.signed.json";

const MNEMONIC12_NOPIN_NOPASSPHRASE =
  "alcohol woman abuse must during monitor noble actual mixed trade anger aisle";

const TIMEOUT = 60 * 1000;

/**
 *  Main integration suite for testing CosmosWallet implementations' Cosmos support.
 */
export function cosmosTests(
  get: () => { wallet: HDWallet; info: HDWalletInfo }
): void {
  let wallet: CosmosWallet & HDWallet;

  describe("Cosmos", () => {
    beforeAll(async () => {
      const { wallet: w } = get();
      if (supportsCosmos(w)) wallet = w;
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

    test.skip(
      "cosmosGetAccountPaths()",
      () => {
        if (!wallet) return;
        let paths = wallet.cosmosGetAccountPaths({ accountIdx: 0 });
        expect(paths.length > 0).toBe(true);
        expect(paths[0].addressNList[0] > 0x80000000).toBe(true);
        paths.forEach((path) => {
          let curAddr = path.addressNList.join();
          let nextAddr = wallet.cosmosNextAccountPath(path).addressNList.join();
          expect(nextAddr === undefined || nextAddr !== curAddr).toBeTruthy();
        });
      },
      TIMEOUT
    );

    test(
      "cosmosGetAddress()",
      async () => {
        if (!wallet) return;
        expect(
          await wallet.cosmosGetAddress({
            addressNList: bip32ToAddressNList("m/44'/118'/0'/0/0"),
            showDisplay: false,
          })
        ).toEqual("cosmos15cenya0tr7nm3tz2wn3h3zwkht2rxrq7q7h3dj");
      },
      TIMEOUT
    );

    test(
      "cosmosSignTx()",
      async () => {
        if (!wallet) return;

        let res = await wallet.cosmosSignTx({
          tx: (tx01_unsigned as unknown) as CosmosTx,
          addressNList: bip32ToAddressNList("m/44'/118'/0'/0/0"),
          chain_id: "cosmoshub-2",
          account_number: "1",
          sequence: "0",
        });
        expect(res).toEqual((tx01_signed as unknown) as CosmosTx);
      },
      TIMEOUT
    );
  });
}
