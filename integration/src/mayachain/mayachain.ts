import * as core from "@shapeshiftoss/hdwallet-core";
import * as keepkey from "@shapeshiftoss/hdwallet-keepkey";
import * as ledger from "@shapeshiftoss/hdwallet-ledger";

import tx_unsigned_swap_amino from "./tx01.mainnet.mayachain.swap.amino.json";
import tx_unsigned_swap from "./tx01.mainnet.mayachain.swap.json";
import tx_signed_swap_amino from "./tx01.mainnet.mayachain.swap.signed.amino.json";
import tx_signed_swap from "./tx01.mainnet.mayachain.swap.signed.json";
import tx_unsigned_transfer_amino from "./tx01.mainnet.mayachain.transfer.amino.json";
import tx_unsigned_transfer from "./tx01.mainnet.mayachain.transfer.json";
import tx_signed_transfer_amino from "./tx01.mainnet.mayachain.transfer.signed.amino.json";
import tx_signed_transfer from "./tx01.mainnet.mayachain.transfer.signed.json";

const MNEMONIC12_NOPIN_NOPASSPHRASE = "alcohol woman abuse must during monitor noble actual mixed trade anger aisle";

const TIMEOUT = 60 * 1000;

/**
 *  Main integration suite for testing MayachainWallet implementations' Mayachain support.
 */
export function mayachainTests(get: () => { wallet: core.HDWallet; info: core.HDWalletInfo }): void {
  let wallet: core.MayachainWallet & core.HDWallet;
  let useAmino: boolean;

  describe("Mayachain", () => {
    beforeAll(async () => {
      const { wallet: w } = get();
      if (core.supportsMayachain(w)) wallet = w;
      useAmino = w instanceof keepkey.KeepKeyHDWallet || w instanceof ledger.LedgerHDWallet;
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
      "mayachainGetAccountPaths()",
      () => {
        if (!wallet) return;
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
        expect(
          await wallet.mayachainGetAddress({
            addressNList: core.bip32ToAddressNList("m/44'/931'/0'/0/0"),
            showDisplay: false,
            testnet: false,
          })
        ).toEqual("maya1ls33ayg26kmltw7jjy55p32ghjna09zp7z4etj");
      },
      TIMEOUT
    );

    describe("mayachainSignTx()", () => {
      it.each([
        [
          "should correctly sign a transfer tx",
          tx_unsigned_transfer_amino,
          tx_unsigned_transfer,
          tx_signed_transfer_amino,
          tx_signed_transfer,
        ],
        [
          "should correctly sign a swap tx",
          tx_unsigned_swap_amino,
          tx_unsigned_swap,
          tx_signed_swap_amino,
          tx_signed_swap,
        ],
      ])(
        "%s",
        async (_, aminoTx, protoTx, signedAminoTx, signedProtoTx) => {
          const tx = useAmino ? aminoTx : protoTx;
          const signedTx = useAmino ? signedAminoTx : signedProtoTx;

          if (!wallet || !tx) return;

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
