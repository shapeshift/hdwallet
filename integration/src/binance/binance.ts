import { bip32ToAddressNList, HDWallet, BinanceWallet, supportsBinance } from "@shapeshiftoss/hdwallet-core";
import { isKeepKey } from "@shapeshiftoss/hdwallet-keepkey";
import { HDWalletInfo } from "@shapeshiftoss/hdwallet-core/src/wallet";

import tx02_unsigned from "./tx02.mainnet.unsigned.json";
import tx02_signed from "./tx02.mainnet.signed.json";

const MNEMONIC12_NOPIN_NOPASSPHRASE = "alcohol woman abuse must during monitor noble actual mixed trade anger aisle";

const TIMEOUT = 60 * 1000;

/**
 *  Main integration suite for testing BinanceWallet implementations' Cosmos support.
 */
export function binanceTests(get: () => { wallet: HDWallet; info: HDWalletInfo }): void {
  let wallet: BinanceWallet & HDWallet;

  describe("Binance", () => {
    beforeAll(async () => {
      const { wallet: w } = get();
      if (supportsBinance(w)) wallet = w;
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
      "binanceGetAccountPaths()",
      () => {
        if (!wallet) return;
        const paths = wallet.binanceGetAccountPaths({ accountIdx: 0 });
        expect(paths.length > 0).toBe(true);
        expect(paths[0].addressNList[0] > 0x80000000).toBe(true);
      },
      TIMEOUT
    );

    test(
      "binanceGetAddress()",
      async () => {
        if (!wallet) return;
        expect(
          await wallet.binanceGetAddress({
            addressNList: bip32ToAddressNList("m/44'/714'/0'/0/0"),
            showDisplay: false,
          })
        ).toEqual("bnb1afwh46v6nn30nkmugw5swdmsyjmlxslgjfugre");
      },
      TIMEOUT
    );

    test(
      "binanceSignTx()",
      async () => {
        if (!wallet) return;

        let res = await wallet.binanceSignTx({
          tx: tx02_unsigned,
          addressNList: bip32ToAddressNList("m/44'/714'/0'/0/0"),
          chain_id: "Binance-Chain-Nile",
          account_number: "24250",
          sequence: 0,
        });

        // Check that the signed transaction matches tx02_signed -- KeepKey doesn't provide this field,
        // but the tests will be run with hdwallet-native as well, which will prove this invariant under
        // the assumption that both are generating signatures over the same data.
        if (res.serialized) expect(res.serialized).toEqual(tx02_signed.serialized);

        // Check that the pubkey used to sign the transaction matches the one used to sign tx02_signed
        const pubKeyHex = Buffer.from(res.signatures.pub_key, "base64").toString("hex");
        expect(pubKeyHex).toEqual(tx02_signed.signatures.pub_key);

        // Check that the signature matches the one on tx02_signed
        const expectedSig = Buffer.from(tx02_signed.signatures[isKeepKey(wallet) ? "kksignature" : "signature"], "base64");
        const actualSig = Buffer.from(res.signatures.signature, "base64");
        expect(actualSig.toString("base64")).toEqual(expectedSig.toString("base64"));
      },
      TIMEOUT
    );
  });
}
