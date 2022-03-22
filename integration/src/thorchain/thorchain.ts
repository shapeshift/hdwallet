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
        expect(
          wallet.describePath({
            path: core.bip32ToAddressNList("m/44'/931'/0'/0/0"),
            coin: "Thorchain",
          })
        );
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

        switch (wallet.getVendor()) {
          case "KeepKey": {
            const res = await wallet.thorchainSignTx(input);
            // eslint-disable-next-line jest/no-conditional-expect
            expect((res?.signatures[0] as any).signature).toEqual(tx_signed.signatures[0].signature);
            break;
          }
          default: {
            // eslint-disable-next-line jest/no-conditional-expect
            await expect(wallet.thorchainSignTx(input)).rejects.toThrowErrorMatchingInlineSnapshot(
              `"Unhandled tx type! type: thorchain/MsgSend"`
            );
            break;
          }
        }
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

        switch (wallet.getVendor()) {
          case "KeepKey": {
            const res = await wallet.thorchainSignTx(input);
            // eslint-disable-next-line jest/no-conditional-expect
            expect((res?.signatures[0] as any).signature).toMatchInlineSnapshot(
              `"ZRRXwAGESNaon0pYE1GZjU1qGsCXZkpKZJpdkAicNyN7J7ywDoGjsVD/lNhrKyrmCj51wmH3unOW7NFi+jcJXw=="`
            );
            break;
          }
          default: {
            // eslint-disable-next-line jest/no-conditional-expect
            await expect(wallet.thorchainSignTx(input)).rejects.toThrowErrorMatchingInlineSnapshot(
              `"Unhandled tx type! type: thorchain/MsgDeposit"`
            );
            break;
          }
        }
      },
      TIMEOUT
    );
  });
}
