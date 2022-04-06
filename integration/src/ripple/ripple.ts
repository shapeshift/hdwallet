import * as core from "@shapeshiftoss/hdwallet-core";

import * as tx01_signed from "./tx01.signed.json";
import * as tx01_unsigned from "./tx01.unsigned.json";

const MNEMONIC12_NOPIN_NOPASSPHRASE = "alcohol woman abuse must during monitor noble actual mixed trade anger aisle";

const TIMEOUT = 60 * 1000;

/**
 *  Main integration suite for testing RippleWallet implementations' Ripple support.
 */
export function rippleTests(get: () => { wallet: core.HDWallet; info: core.HDWalletInfo }): void {
  let wallet: core.RippleWallet & core.HDWallet;

  describe("Ripple", () => {
    beforeAll(async () => {
      const { wallet: w } = get();
      if (core.supportsRipple(w)) wallet = w;
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
      "rippleGetAccountPaths()",
      () => {
        if (!wallet) return;
        const paths = wallet.rippleGetAccountPaths({ accountIdx: 0 });
        expect(paths.length > 0).toBe(true);
        expect(paths[0].addressNList[0] > 0x80000000).toBe(true);
        paths.forEach((path) => {
          const curAddr = path.addressNList.join();
          const nextAddr = core.mustBeDefined(wallet.rippleNextAccountPath(path)).addressNList.join();
          expect(nextAddr === undefined || nextAddr !== curAddr).toBeTruthy();
        });
      },
      TIMEOUT
    );

    test(
      "rippleGetAddress()",
      async () => {
        if (!wallet) return;
        expect(
          await wallet.rippleGetAddress({
            addressNList: core.bip32ToAddressNList("m/44'/144'/0'/0/0"),
            showDisplay: false,
          })
        ).toEqual("rh5ZnEVySAy7oGd3nebT3wrohGDrsNS83E");
      },
      TIMEOUT
    );

    test(
      "rippleSignTx()",
      async () => {
        if (!wallet) return;

        const res = await wallet.rippleSignTx({
          addressNList: core.bip32ToAddressNList(`m/44'/144'/0'/0/0`),
          tx: tx01_unsigned as unknown as core.RippleTx,
          flags: undefined,
          sequence: "3",
          lastLedgerSequence: "0",
          payment: {
            amount: "47000",
            destination: "rh5ZnEVySAy7oGd3nebT3wrohGDrsNS83E",
            destinationTag: "1234567890",
          },
        });
        expect(res).toEqual(tx01_signed as unknown as core.RippleTx);
      },
      TIMEOUT
    );
  });
}
