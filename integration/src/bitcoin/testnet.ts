import {
  bip32ToAddressNList,
  HDWallet,
  BTCWallet,
  supportsBTC,
  BTCInputScriptType,
  BTCOutputAddressType,
  BTCOutputScriptType,
  Coin,
  HDWalletInfo,
} from "@shapeshiftoss/hdwallet-core";
import { isLedger } from "@shapeshiftoss/hdwallet-ledger";
import { isPortis } from "@shapeshiftoss/hdwallet-portis";

import { each } from "../utils";

const MNEMONIC12_NOPIN_NOPASSPHRASE =
  "alcohol woman abuse must during monitor noble actual mixed trade anger aisle";
const MNEMONIC12_ALLALL = "all all all all all all all all all all all all";

const TIMEOUT = 60 * 1000;

/**
 *  Main integration suite for testing BTCWallet implementations' Bitcoin Testnet support.
 */
export function testnetTests(
  get: () => { wallet: HDWallet; info: HDWalletInfo }
): void {
  let wallet: BTCWallet & HDWallet;

  describe("Testnet", () => {
    beforeAll(() => {
      const { wallet: w } = get();
      if (supportsBTC(w)) wallet = w;
    });

    beforeEach(async () => {
      if (!wallet) return;
      await wallet.wipe();
      await wallet.loadDevice({
        mnemonic: MNEMONIC12_ALLALL,
        label: "test",
        skipChecksum: true,
      });
    }, TIMEOUT);

    test(
      "btcSignTx() - p2sh-p2wpkh",
      async () => {
        if (!wallet || isPortis(wallet)) return;
        if (isLedger(wallet)) return; // FIXME: Expected failure
        if (!wallet.btcSupportsCoin("Testnet")) return;
        let inputs = [
          {
            addressNList: bip32ToAddressNList("m/49'/1'/0'/1/0"),
            scriptType: BTCInputScriptType.SpendP2SHWitness,
            amount: String(123456789),
            vout: 0,
            txid:
              "20912f98ea3ed849042efed0fdac8cb4fc301961c5988cba56902d8ffb61c337",
            hex:
              "01000000013a14418ce8bcac00a0cb56bf8a652110f4897cfcd736e1ab5e943b84f0ab2c80000000006a4730440220548e087d0426b20b8a571b03b9e05829f7558b80c53c12143e342f56ab29e51d02205b68cb7fb223981d4c999725ac1485a982c4259c4f50b8280f137878c232998a012102794a25b254a268e59a5869da57fbae2fadc6727cb3309321dab409b12b2fa17cffffffff0215cd5b070000000017a91458b53ea7f832e8f096e896b8713a8c6df0e892ca87ccc69633000000001976a914b84bacdcd8f4cc59274a5bfb73f804ca10f7fd1488ac00000000",
          },
        ];
        let outputs = [
          {
            address: "mhRx1CeVfaayqRwq5zgRQmD7W5aWBfD5mC",
            addressType: BTCOutputAddressType.Spend,
            amount: String(12300000),
            isChange: false,
          },
          {
            addressNList: bip32ToAddressNList("m/49'/1'/0'/1/0"),
            scriptType: BTCOutputScriptType.PayToP2SHWitness,
            addressType: BTCOutputAddressType.Change,
            amount: String(123456789 - 11000 - 12300000),
            isChange: true,
          },
        ];
        let res = await wallet.btcSignTx({
          coin: "Testnet",
          inputs: inputs,
          outputs: outputs,
          version: 1,
          locktime: 0,
        });
        expect(res.serializedTx).toEqual(
          "0100000000010137c361fb8f2d9056ba8c98c5611930fcb48cacfdd0fe2e0449d83eea982f91200000000017160014d16b8c0680c61fc6ed2e407455715055e41052f5ffffffff02e0aebb00000000001976a91414fdede0ddc3be652a0ce1afbc1b509a55b6b94888ac3df39f060000000017a91458b53ea7f832e8f096e896b8713a8c6df0e892ca8702483045022100ccd253bfdf8a5593cd7b6701370c531199f0f05a418cd547dfc7da3f21515f0f02203fa08a0753688871c220648f9edadbdb98af42e5d8269364a326572cf703895b012103e7bfe10708f715e8538c92d46ca50db6f657bbc455b7494e6a0303ccdb868b7900000000"
        );
      },
      TIMEOUT
    );

    test("btcSignTx() - p2wpkh", async () => {
      if (!wallet || isPortis(wallet)) return;
      if (isLedger(wallet)) return; // FIXME: Expected failure
      if (!wallet.btcSupportsCoin("Testnet")) return;
      let inputs = [
        {
          addressNList: bip32ToAddressNList("m/84'/1'/0'/0/0"),
          scriptType: BTCInputScriptType.SpendWitness,
          amount: String(12300000),
          vout: 0,
          txid:
            "09144602765ce3dd8f4329445b20e3684e948709c5cdcaf12da3bb079c99448a",
          hex:
            "010000000137c361fb8f2d9056ba8c98c5611930fcb48cacfdd0fe2e0449d83eea982f91200000000017160014d16b8c0680c61fc6ed2e407455715055e41052f5ffffffff02e0aebb00000000001600140099a7ecbd938ed1839f5f6bf6d50933c6db9d5c3df39f060000000017a91458b53ea7f832e8f096e896b8713a8c6df0e892ca8700000000",
        },
      ];
      let outputs = [
        {
          address: "2N4Q5FhU2497BryFfUgbqkAJE87aKHUhXMp",
          addressType: BTCOutputAddressType.Spend,
          amount: String(5000000),
          isChange: false,
        },
        {
          addressNList: bip32ToAddressNList("m/84'/1'/0'/1/0"),
          scriptType: BTCOutputScriptType.PayToWitness,
          addressType: BTCOutputAddressType.Change,
          amount: String(12300000 - 11000 - 5000000),
          isChange: true,
        },
      ];
      let res = await wallet.btcSignTx({
        coin: "Testnet",
        inputs: inputs,
        outputs: outputs,
        version: 1,
        locktime: 0,
      });
      expect(res.serializedTx).toEqual(
        "010000000001018a44999c07bba32df1cacdc50987944e68e3205b4429438fdde35c76024614090000000000ffffffff02404b4c000000000017a9147a55d61848e77ca266e79a39bfc85c580a6426c987a8386f0000000000160014cc8067093f6f843d6d3e22004a4290cd0c0f336b024730440220067675423ca6a0be3ddd5e13da00a9433775041e5cebc838873d2686f1d2840102201a5819e0312e6451d6b6180689101bce995685a51524cc4c3a5383f7bdab979a012103adc58245cf28406af0ef5cc24b8afba7f1be6c72f279b642d85c48798685f86200000000"
      );
    });
  });
}
