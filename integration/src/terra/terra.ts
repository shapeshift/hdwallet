import * as core from "@shapeshiftoss/hdwallet-core";

import tx_unsigned from "./tx01.testnet.terra.json";
import tx_signed from "./tx01.testnet.terra.signed.json";


const MNEMONIC12_NOPIN_NOPASSPHRASE = "alcohol woman abuse must during monitor noble actual mixed trade anger aisle";

const TIMEOUT = 60 * 1000;

/**
 *  Main integration suite for testing TerraWallet implementations' Terra support.
 */
export function terraTests(get: () => { wallet: core.HDWallet; info: core.HDWalletInfo }): void {
  let wallet: core.TerraWallet & core.HDWallet;

  describe("Terra", () => {
    beforeAll(async () => {
      const { wallet: w } = get();
      if (core.supportsTerra(w)) wallet = w;
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
      "terraGetAccountPaths()",
      () => {
        if (!wallet) return;
        const paths = wallet.terraGetAccountPaths({ accountIdx: 0 });
        expect(paths.length > 0).toBe(true);
        expect(paths[0].addressNList[0] > 0x80000000).toBe(true);
      },
      TIMEOUT
    );

    test(
      "describePath() terra",
      async () => {
        if (!wallet) return;
        expect(
          wallet.describePath({
            path: core.bip32ToAddressNList("m/44'/931'/0'/0/0"),
            coin: "Terra"
          }),
        );
      },
      TIMEOUT
    );

    test(
      "terraGetAddress()",
      async () => {
        if (!wallet) return;
        expect(
          await wallet.terraGetAddress({
            addressNList: core.bip32ToAddressNList("m/44'/931'/0'/0/0"),
            showDisplay: false,
            testnet: true
          })
        ).toEqual("tthor1ls33ayg26kmltw7jjy55p32ghjna09zp6z69y8");
      },
      TIMEOUT
    );

    test(
      "terraSignTx()",
      async () => {
        if (!wallet) return;
        const input: core.TerraSignTx = {
          tx: tx_unsigned as any,
          addressNList: core.bip32ToAddressNList("m/44'/931'/0'/0/0"),
          chain_id: "terra",
          account_number: "16354",
          sequence: "5",
        };

        const res = await wallet.terraSignTx(input);
        switch(wallet.getVendor()){
          case "KeepKey":
            expect(res.signatures[0].signature).toEqual(tx_signed.tx.signatures[0].signature_keepkey);
            break;
          default:
            expect(res.signatures[0].signature).toEqual(tx_signed.tx.signatures[0].signature);
            break;

        }
      },
      TIMEOUT
    );
  });
}
