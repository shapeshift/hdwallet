import { bip32ToAddressNList, HDWallet, CosmosWallet, supportsCosmos, CosmosTx } from "@shapeshiftoss/hdwallet-core";
import { HDWalletInfo } from "@shapeshiftoss/hdwallet-core/src/wallet";

import tx01_unsigned from "./tx01.unsigned.json";
// @ts-ignore
import tx01_signed from "./tx01.signed.json";

const MNEMONIC12_NOPIN_NOPASSPHRASE = "alcohol woman abuse must during monitor noble actual mixed trade anger aisle";

const TIMEOUT = 60 * 1000;

/**
 *  Main integration suite for testing CosmosWallet implementations' Cosmos support.
 */
export function cosmosTests(get: () => { wallet: HDWallet; info: HDWalletInfo }): void {
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

    test(
      "cosmosGetAccountPaths()",
      () => {
        if (!wallet) return;
        console.log("wallet: ", wallet);
        let paths = wallet.cosmosGetAccountPaths({ accountIdx: 0 });
        expect(paths.length > 0).toBe(true);
        expect(paths[0].addressNList[0] > 0x80000000).toBe(true);
        //TODO We don't use nextPath on cosmos?
        // paths.forEach((path) => {
        //   let curAddr = path.addressNList.join();
        //   let nextAddr = wallet.cosmosNextAccountPath(path).addressNList.join();
        //   expect(nextAddr === undefined || nextAddr !== curAddr).toBeTruthy();
        // });
      },
      TIMEOUT
    );

    test(
      "cosmosGetAddress()",
      async () => {
        if (!wallet) return;
        expect(
          await wallet.cosmosGetAddress({
            relPath: [0, 0],
            addressNList: bip32ToAddressNList("m/44'/118'/0'/0/0"),
            hardenedPath: bip32ToAddressNList("m/44'/118'/0'"),
            showDisplay: false,
          })
        ).toEqual("cosmos15cenya0tr7nm3tz2wn3h3zwkht2rxrq7q7h3dj");
      },
      TIMEOUT
    );

    test.only(
      "cosmosSignTx()",
      async () => {
        if (!wallet) return;

        console.log("**** tx01_unsigned: ", tx01_unsigned);

        let input = {
          tx: tx01_unsigned,
          addressNList: bip32ToAddressNList("m/44'/118'/0'/0/0"),
          chain_id: "cosmoshub-2",
          account_number: "1",
          sequence: "0",
        };

        console.log("**** input.tx: ", input.tx);

        let res = await wallet.cosmosSignTx(input);

        console.log("signedTx: ", typeof res);
        console.log("signedTx: ", res);
        console.log("signedTx: ", res.value);
        console.log("signedTx: ", res.value.signatures);
        console.log("signedTx: ", res.value.signatures[0]);
        console.log("signedTx: ", res.value.signatures[0].signature);
        console.log("signedTx: ", JSON.stringify(res));

        console.log("tx01_signed: ", typeof tx01_signed);
        console.log("tx01_signed: ", tx01_signed);
        console.log("tx01_signed: ", tx01_signed.value);
        console.log("tx01_signed: ", tx01_signed.value.signatures);
        console.log("tx01_signed: ", JSON.stringify(tx01_signed));

        //TODO validate sig
        console.log("SIG Generated:", res.value.signatures[0].signature);
        console.log("SIG  Expected: ", tx01_signed.value.signatures[0].signature);

        //
      },
      TIMEOUT
    );
  });
}
