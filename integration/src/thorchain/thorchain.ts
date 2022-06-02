import * as core from "@shapeshiftoss/hdwallet-core";

import tx_unsigned from "./tx02.mainnet.thorchain.json";
import tx_signed from "./tx02.mainnet.thorchain.signed.json";
import tx_unsigned_swap from "./tx03.mainnet.thorchain.swap.json";
import tx_signed_swap from "./tx03.mainnet.thorchain.swap.signed.json";

const MNEMONIC12_NOPIN_NOPASSPHRASE = "alcohol woman abuse must during monitor noble actual mixed trade anger aisle";

const TIMEOUT = 60 * 1000;

/**
 *  Main integration suite for testing ThorchainWallet implementations' Thorchain support.
 */
export function thorchainTests(get: () => { wallet: core.HDWallet; info: core.HDWalletInfo }): void {
  let wallet: core.ThorchainWallet & core.HDWallet;

  describe("Thorchain", () => {
    beforeAll(async () => {
      const { wallet: w } = get();
      if (core.supportsThorchain(w)) wallet = w;
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
      "thorchainGetAccountPaths()",
      () => {
        if (!wallet) return;
        const paths = wallet.thorchainGetAccountPaths({ accountIdx: 0 });
        expect(paths.length > 0).toBe(true);
        expect(paths[0].addressNList[0] > 0x80000000).toBe(true);
      },
      TIMEOUT
    );

    test(
      "describePath() thorchain",
      async () => {
        if (!wallet) return;

        const out = wallet.describePath({
          path: core.bip32ToAddressNList("m/44'/931'/0'/0/0"),
          coin: "Thorchain",
        });

        // This is strange, and probably wrong, behavior... but it's what happens.
        if (wallet.getVendor() === "KeepKey") {
          // eslint-disable-next-line jest/no-conditional-expect
          expect(out).toMatchInlineSnapshot(`
          Object {
            "coin": "Thorchain",
            "isKnown": false,
            "scriptType": undefined,
            "verbose": "m/44'/931'/0'/0/0",
          }
          `);
        } else {
          // eslint-disable-next-line jest/no-conditional-expect
          expect(out).toMatchInlineSnapshot(`
            Object {
              "accountIdx": 0,
              "coin": "Thorchain",
              "isKnown": true,
              "isPrefork": false,
              "verbose": "Thorchain Account #0",
              "wholeAccount": true,
            }
          `);
        }
      },
      TIMEOUT
    );

    test(
      "thorchainGetAddress()",
      async () => {
        if (!wallet) return;
        expect(
          await wallet.thorchainGetAddress({
            addressNList: core.bip32ToAddressNList("m/44'/931'/0'/0/0"),
            showDisplay: false,
            testnet: false,
          })
        ).toEqual("thor1ls33ayg26kmltw7jjy55p32ghjna09zp74t4az");
      },
      TIMEOUT
    );

    test(
      "thorchainSignTx()",
      async () => {
        if (!wallet) return;
        const input: core.ThorchainSignTx = {
          tx: tx_unsigned as any,
          addressNList: core.bip32ToAddressNList("m/44'/931'/0'/0/0"),
          chain_id: "thorchain",
          account_number: "17",
          sequence: "2",
        };

        const res = await wallet.thorchainSignTx(input);
        expect(res?.signatures?.[0].signature).toEqual(tx_signed.signatures[0].signature);
      },
      TIMEOUT
    );

    test(
      "thorchainSignTx() (thorchain/MsgDeposit)",
      async () => {
        if (!wallet) return;
        const input: core.ThorchainSignTx = {
          tx: tx_unsigned_swap as any,
          addressNList: core.bip32ToAddressNList("m/44'/931'/0'/0/0"),
          chain_id: "thorchain",
          account_number: "2722",
          sequence: "4",
        };

        const res = await wallet.thorchainSignTx(input);
        expect(res?.signatures?.[0].signature).toEqual(tx_signed_swap.signatures[0].signature);
      },
      TIMEOUT
    );
  });
}
