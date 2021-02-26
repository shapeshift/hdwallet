import * as core from "@shapeshiftoss/hdwallet-core";

import tx_unsigned from "./tx01.testnet.thorchain.json";
import tx_signed from "./tx01.testnet.thorchain.signed.json";

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
      "thorchainGetAddress()",
      async () => {
        if (!wallet) return;
        expect(
          await wallet.thorchainGetAddress({
            addressNList: core.bip32ToAddressNList("m/44'/934'/0'/0/0"),
            showDisplay: false,
          })
        ).toEqual("tthor1xz76k44xrm8cks8h0knnvx3njdzwrmrq48xhzn");
      },
      TIMEOUT
    );

    test(
      "thorchainSignTx()",
      async () => {
        if (!wallet) return;
        const input: core.ThorchainSignTx = {
          tx: tx_unsigned as any,
          addressNList: core.bip32ToAddressNList("m/44'/934'/0'/0/0"),
          chain_id: "thorchain",
          account_number: "16354",
          sequence: "5",
        };

        const res = await wallet.thorchainSignTx(input);
        expect(res.signatures[0].signature).toEqual(tx_signed.value.signatures[0].signature);
      },
      TIMEOUT
    );
  });
}
