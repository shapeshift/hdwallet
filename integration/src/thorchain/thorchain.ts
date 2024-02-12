import * as core from "@keepkey/hdwallet-core";
import * as keepkey from "@keepkey/hdwallet-keepkey";

import tx_unsigned_swap_amino from "./tx01.mainnet.thorchain.swap.amino.json";
import tx_unsigned_swap from "./tx01.mainnet.thorchain.swap.json";
import tx_signed_swap_amino from "./tx01.mainnet.thorchain.swap.signed.amino.json";
import tx_signed_swap from "./tx01.mainnet.thorchain.swap.signed.json";
import tx_unsigned_transfer_amino from "./tx01.mainnet.thorchain.transfer.amino.json";
import tx_unsigned_transfer from "./tx01.mainnet.thorchain.transfer.json";
import tx_signed_transfer_amino from "./tx01.mainnet.thorchain.transfer.signed.amino.json";
import tx_signed_transfer from "./tx01.mainnet.thorchain.transfer.signed.json";

const MNEMONIC12_NOPIN_NOPASSPHRASE = "alcohol woman abuse must during monitor noble actual mixed trade anger aisle";

const TIMEOUT = 60 * 1000;

/**
 *  Main integration suite for testing ThorchainWallet implementations' Thorchain support.
 */
export function thorchainTests(get: () => { wallet: core.HDWallet; info: core.HDWalletInfo }): void {
  let wallet: core.ThorchainWallet & core.HDWallet;
  let useAmino: boolean;

  describe("Thorchain", () => {
    beforeAll(async () => {
      const { wallet: w } = get();
      if (core.supportsThorchain(w)) wallet = w;
      useAmino = w instanceof keepkey.KeepKeyHDWallet;
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

    describe("thorchainSignTx()", () => {
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

          const input: core.ThorchainSignTx = {
            tx,
            addressNList: core.bip32ToAddressNList("m/44'/931'/0'/0/0"),
            chain_id: tx.chain_id,
            account_number: tx.account_number,
            sequence: tx.sequence,
          };

          const res = await wallet.thorchainSignTx(input);
          expect(res).toEqual(signedTx);
        },
        TIMEOUT
      );
    });
  });
}
