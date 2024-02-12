import * as core from "@shapeshiftoss/hdwallet-core";

import { each } from "../utils";

const MNEMONIC12_NOPIN_NOPASSPHRASE = "alcohol woman abuse must during monitor noble actual mixed trade anger aisle";

const TIMEOUT = 60 * 1000;

/**
 *  Main integration suite for testing BTCWallet implementations' Litecoin support.
 */
export function litecoinTests(get: () => { wallet: core.HDWallet; info: core.HDWalletInfo }): void {
  let wallet: core.BTCWallet & core.HDWallet;

  describe("Litecoin", () => {
    beforeAll(() => {
      const { wallet: w } = get();
      if (core.supportsBTC(w)) wallet = w;
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
      "btcGetAddress()",
      async () => {
        if (!wallet) return;
        if (!(await wallet.btcSupportsCoin("Litecoin"))) return;
        await each(
          [
            [
              "Show",
              "Litecoin",
              "m/44'/2'/0'/0/0",
              core.BTCInputScriptType.SpendAddress,
              "LYXTv5RdsPYKC4qGmb6x6SuKoFMxUdSjLQ",
            ],
            [
              "Tell",
              "Litecoin",
              "m/49'/2'/0'/0/0",
              core.BTCInputScriptType.SpendP2SHWitness,
              "MFoQRU1KQq365Sy3cXhix3ygycEU4YWB1V",
            ],
            [
              "Tell",
              "Litecoin",
              "m/84'/2'/0'/0/0",
              core.BTCInputScriptType.SpendWitness,
              "ltc1qf6pwfkw4wd0fetq2pfrwzlfknskjg6nyvt6ngv",
            ],
          ],
          async (args) => {
            const mode = args[0] as string;
            const coin = args[1] as core.Coin;
            const path = args[2] as string;
            const scriptType = args[3] as core.BTCInputScriptType;
            const expected = args[4] as string;

            if (!(await wallet.btcSupportsScriptType(coin, scriptType))) return;
            const res = await wallet.btcGetAddress({
              addressNList: core.bip32ToAddressNList(path),
              coin: coin,
              showDisplay: mode === "Show",
              scriptType: scriptType,
            });
            expect(res).toEqual(expected);
          }
        );
      },
      TIMEOUT
    );

    test(
      "btcGetAccountPaths()",
      async () => {
        await each(
          [
            ["Litecoin", 1, core.BTCInputScriptType.SpendAddress],
            ["Litecoin", 1, core.BTCInputScriptType.SpendP2SHWitness],
            ["Litecoin", 1, core.BTCInputScriptType.SpendWitness],
          ],
          async (args) => {
            const coin = args[0] as core.Coin;
            const accountIdx = args[1] as number;
            const scriptType = args[2] as core.BTCInputScriptType;
            if (!wallet) return;
            if (!(await wallet.btcSupportsCoin(coin))) return;
            if (!(await wallet.btcSupportsScriptType(coin, scriptType))) return;
            const paths = wallet.btcGetAccountPaths({
              coin: coin,
              accountIdx: accountIdx,
              scriptType: scriptType,
            });
            expect(paths.length).toBeGreaterThan(0);
          }
        );
      },
      TIMEOUT
    );

    test(
      "btcIsSameAccount()",
      async () => {
        if (!wallet) return;
        [0, 1, 9].forEach((idx) => {
          const paths = wallet.btcGetAccountPaths({
            coin: "Litecoin",
            accountIdx: idx,
          });
          expect(typeof wallet.btcIsSameAccount(paths) === typeof true).toBeTruthy();
        });
      },
      TIMEOUT
    );
  });
}
