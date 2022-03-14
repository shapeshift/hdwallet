import * as core from "@shapeshiftoss/hdwallet-core";
import stableStringify from "fast-json-stable-stringify";

import { decodeBnbTx, validateBnbTx } from "./bnbdecoder";
import tx02_signed from "./tx02.mainnet.signed.json";
import tx02_unsigned from "./tx02.mainnet.unsigned.json";

const MNEMONIC12_NOPIN_NOPASSPHRASE = "alcohol woman abuse must during monitor noble actual mixed trade anger aisle";

const TIMEOUT = 60 * 1000;

/**
 *  Main integration suite for testing BinanceWallet implementations' Cosmos support.
 */
export function binanceTests(get: () => { wallet: core.HDWallet; info: core.HDWalletInfo }): void {
  let wallet: core.BinanceWallet & core.HDWallet;

  describe("Binance", () => {
    beforeAll(async () => {
      const { wallet: w } = get();
      if (core.supportsBinance(w)) wallet = w;
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
            addressNList: core.bip32ToAddressNList("m/44'/714'/0'/0/0"),
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

        // Check that tx02_unsigned and tx02_signed match
        const { txid, serialized, signatures } = tx02_signed;
        expect(Object.assign({}, tx02_unsigned, { txid, serialized, signatures })).toStrictEqual(tx02_signed);

        const input = {
          // Kludgy hack required until microsoft/TypeScript#32063 is fixed
          tx: tx02_unsigned as Omit<typeof tx02_unsigned, "msgs"> & {
            msgs: typeof tx02_unsigned.msgs extends Array<infer R> ? [R] : never;
          },
          addressNList: core.bip32ToAddressNList("m/44'/714'/0'/0/0"),
          chain_id: tx02_unsigned.chain_id,
          account_number: tx02_unsigned.account_number,
          sequence: tx02_unsigned.sequence,
        };
        const res = core.mustBeDefined(await wallet.binanceSignTx(input));

        // Check that the signed transaction matches tx02_signed -- KeepKey doesn't provide this field,
        // but the tests will be run with hdwallet-native as well, which will prove this invariant under
        // the assumption that both are generating signatures over the same data.
        // eslint-disable-next-line jest/no-conditional-expect
        if (res.serialized) expect(res.serialized).toEqual(tx02_signed.serialized);
        const txBytes = Buffer.from(tx02_signed.serialized, "hex");
        expect(validateBnbTx(txBytes, input.chain_id)).toEqual(true);

        // Check that the pubkey used to sign the transaction matches the one used to sign tx02_signed
        const pubKeyHex = Buffer.from(res.signatures.pub_key, "base64").toString("hex");
        expect(pubKeyHex).toEqual(tx02_signed.signatures.pub_key);

        // Check that the signature matches the one on tx02_signed
        const expectedSig = Buffer.from(tx02_signed.signatures.signature, "base64");
        const actualSig = Buffer.from(res.signatures.signature, "base64");
        expect(actualSig.toString("base64")).toEqual(expectedSig.toString("base64"));

        const { signBytes, pubKey: serializedPubKey } = decodeBnbTx(txBytes, input.chain_id);
        expect(serializedPubKey.toString("hex")).toEqual(pubKeyHex);

        // signBytes treats amounts as numbers, not strings, even though it treats all
        // other numbers as strings.
        const msgNormalizerInner = (x: any) => ({
          ...x,
          coins: x.coins.map((y: any) => ({
            ...y,
            amount: Number(y.amount),
          })),
        });
        const msgNormalizer = (x: any) => ({
          ...x,
          inputs: x.inputs.map((y: any) => msgNormalizerInner(y)),
          outputs: x.outputs.map((y: any) => msgNormalizerInner(y)),
        });
        expect(signBytes).toEqual(
          stableStringify({
            ...tx02_unsigned,
            chain_id: input.chain_id,
            msgs: tx02_unsigned.msgs.map((x: any) => msgNormalizer(x)),
          })
        );
      },
      TIMEOUT
    );
  });
}
