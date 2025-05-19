import * as core from "@shapeshiftoss/hdwallet-core";
import * as keepkey from "@shapeshiftoss/hdwallet-keepkey";
import * as ledger from "@shapeshiftoss/hdwallet-ledger";
import * as metamask from "@shapeshiftoss/hdwallet-metamask-multichain";

import tx_unsigned_transfer from "./tx01.mainnet.mayachain.transfer.json";
import tx_signed_transfer from "./tx01.mainnet.mayachain.transfer.signed.json";

const MNEMONIC12_NOPIN_NOPASSPHRASE = "alcohol woman abuse must during monitor noble actual mixed trade anger aisle";

const TIMEOUT = 60 * 1000;

/**
 *  Main integration suite for testing MayachainWallet implementations' Mayachain support.
 */
export function mayachainTests(get: () => { wallet: core.HDWallet; info: core.HDWalletInfo }): void {
  let wallet: core.MayachainWallet & core.HDWallet;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let useAmino: boolean;

  describe("Mayachain", () => {
    beforeAll(async () => {
      const { wallet: w } = get();
      // Non-EVM things are a pain to test with snaps on test env, this wasn't tested before and still isn't
      if (metamask.isMetaMask(wallet)) return;
      if (core.supportsMayachain(w)) wallet = w;
      useAmino = w instanceof keepkey.KeepKeyHDWallet || w instanceof ledger.LedgerHDWallet;
    });

    beforeEach(async () => {
      if (!wallet) return;
      // Non-EVM things are a pain to test with snaps on test env, this wasn't tested before and still isn't
      if (metamask.isMetaMask(wallet)) return;
      await wallet.wipe();
      await wallet.loadDevice({
        mnemonic: MNEMONIC12_NOPIN_NOPASSPHRASE,
        label: "test",
        skipChecksum: true,
      });
    }, TIMEOUT);

    test(
      "mayachainGetAccountPaths()",
      () => {
        if (!wallet) return;
        // Non-EVM things are a pain to test with snaps on test env, this wasn't tested before and still isn't
        if (metamask.isMetaMask(wallet)) return;
        const paths = wallet.mayachainGetAccountPaths({ accountIdx: 0 });
        expect(paths.length > 0).toBe(true);
        expect(paths[0].addressNList[0] > 0x80000000).toBe(true);
      },
      TIMEOUT
    );

    test(
      "describePath() mayachain",
      async () => {
        if (!wallet) return;
        // Non-EVM things are a pain to test with snaps on test env, this wasn't tested before and still isn't
        if (metamask.isMetaMask(wallet)) return;

        const out = wallet.describePath({
          path: core.bip32ToAddressNList("m/44'/931'/0'/0/0"),
          coin: "Mayachain",
        });

        // This is strange, and probably wrong, behavior... but it's what happens.
        if (wallet.getVendor() === "KeepKey") {
          // eslint-disable-next-line jest/no-conditional-expect
          expect(out).toMatchInlineSnapshot(`
          Object {
            "coin": "Mayachain",
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
              "coin": "Mayachain",
              "isKnown": true,
              "isPrefork": false,
              "verbose": "Mayachain Account #0",
              "wholeAccount": true,
            }
          `);
        }
      },
      TIMEOUT
    );

    test(
      "mayachainGetAddress()",
      async () => {
        if (!wallet) return;
        // Non-EVM things are a pain to test with snaps on test env, this wasn't tested before and still isn't
        if (metamask.isMetaMask(wallet)) return;

        const actual = await wallet.mayachainGetAddress({
          addressNList: core.bip32ToAddressNList("m/44'/931'/0'/0/0"),
          showDisplay: false,
        });

        expect(actual).toEqual("maya1ls33ayg26kmltw7jjy55p32ghjna09zp7z4etj");
      },
      TIMEOUT
    );

    describe("mayachainSignTx()", () => {
      it.each([["should correctly sign a transfer tx", tx_unsigned_transfer, tx_signed_transfer]])(
        "%s",
        async (_, tx, signedProtoTx) => {
          const signedTx = signedProtoTx;

          if (!wallet || !tx) return;
          // Non-EVM things are a pain to test with snaps on test env, this wasn't tested before and still isn't
          if (metamask.isMetaMask(wallet)) return;

          const input: core.MayachainSignTx = {
            tx,
            addressNList: core.bip32ToAddressNList("m/44'/931'/0'/0/0"),
            chain_id: tx.chain_id,
            account_number: tx.account_number,
            sequence: tx.sequence,
          };

          const res = await wallet.mayachainSignTx(input);
          expect(res).toEqual(signedTx);
        },
        TIMEOUT
      );
    });
  });
}
