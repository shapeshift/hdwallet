import * as core from "@shapeshiftoss/hdwallet-core";
import * as ledger from "@shapeshiftoss/hdwallet-ledger";
import * as portis from "@shapeshiftoss/hdwallet-portis";

const MNEMONIC12_ALLALL = "all all all all all all all all all all all all";

const TIMEOUT = 60 * 1000;

/**
 *  Main integration suite for testing BTCWallet implementations' Bitcoin Testnet support.
 */
export function testnetTests(get: () => { wallet: core.HDWallet; info: core.HDWalletInfo }): void {
  let wallet: core.BTCWallet & core.HDWallet;

  describe("Testnet", () => {
    beforeAll(() => {
      const { wallet: w } = get();
      if (core.supportsBTC(w)) wallet = w;
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
        if (!wallet || portis.isPortis(wallet)) return;
        if (ledger.isLedger(wallet)) return; // FIXME: Expected failure
        if (!wallet.btcSupportsCoin("Testnet")) return;
        const inputs: core.BTCSignTxInputUnguarded[] = [
          {
            addressNList: core.bip32ToAddressNList("m/49'/1'/0'/1/0"),
            scriptType: core.BTCInputScriptType.SpendP2SHWitness,
            amount: String(123456789),
            vout: 0,
            txid: "20912f98ea3ed849042efed0fdac8cb4fc301961c5988cba56902d8ffb61c337",
            hex: "01000000013a14418ce8bcac00a0cb56bf8a652110f4897cfcd736e1ab5e943b84f0ab2c80000000006a4730440220548e087d0426b20b8a571b03b9e05829f7558b80c53c12143e342f56ab29e51d02205b68cb7fb223981d4c999725ac1485a982c4259c4f50b8280f137878c232998a012102794a25b254a268e59a5869da57fbae2fadc6727cb3309321dab409b12b2fa17cffffffff0215cd5b070000000017a91458b53ea7f832e8f096e896b8713a8c6df0e892ca87ccc69633000000001976a914b84bacdcd8f4cc59274a5bfb73f804ca10f7fd1488ac00000000",
          },
        ];
        const outputs: core.BTCSignTxOutput[] = [
          {
            address: "mhRx1CeVfaayqRwq5zgRQmD7W5aWBfD5mC",
            addressType: core.BTCOutputAddressType.Spend,
            amount: String(12300000),
            isChange: false,
          },
          {
            addressNList: core.bip32ToAddressNList("m/49'/1'/0'/1/0"),
            scriptType: core.BTCOutputScriptType.PayToP2SHWitness,
            addressType: core.BTCOutputAddressType.Change,
            amount: String(123456789 - 11000 - 12300000),
            isChange: true,
          },
        ];
        const res = await wallet.btcSignTx({
          coin: "Testnet",
          inputs: inputs as core.BTCSignTxInput[],
          outputs,
          version: 1,
          locktime: 0,
        });
        expect(res?.serializedTx).toEqual(
          "0100000000010137c361fb8f2d9056ba8c98c5611930fcb48cacfdd0fe2e0449d83eea982f91200000000017160014d16b8c0680c61fc6ed2e407455715055e41052f5ffffffff02e0aebb00000000001976a91414fdede0ddc3be652a0ce1afbc1b509a55b6b94888ac3df39f060000000017a91458b53ea7f832e8f096e896b8713a8c6df0e892ca8702483045022100ccd253bfdf8a5593cd7b6701370c531199f0f05a418cd547dfc7da3f21515f0f02203fa08a0753688871c220648f9edadbdb98af42e5d8269364a326572cf703895b012103e7bfe10708f715e8538c92d46ca50db6f657bbc455b7494e6a0303ccdb868b7900000000"
        );
      },
      TIMEOUT
    );

    test("btcSignTx() - p2wpkh", async () => {
      if (!wallet || portis.isPortis(wallet)) return;
      if (ledger.isLedger(wallet)) return; // FIXME: Expected failure
      if (!wallet.btcSupportsCoin("Testnet")) return;
      const tx: core.BitcoinTx = {
        version: core.untouchable("tx.version not provided by test"),
        locktime: core.untouchable("tx.locktime not provided by test"),
        vin: core.untouchable("tx.vin not provided by test"),
        vout: [
          {
            value: core.untouchable("tx.vout[0].value not provided by test"),
            scriptPubKey: {
              hex: "0014b31dc2a236505a6cb9201fa0411ca38a254a7bf1",
            },
          },
        ],
      };
      const inputs: core.BTCSignTxInputUnguarded[] = [
        {
          addressNList: core.bip32ToAddressNList("m/84'/1'/0'/0/0"),
          scriptType: core.BTCInputScriptType.SpendWitness,
          amount: String(100000),
          vout: 0,
          txid: "e4b5b24159856ea18ab5819832da3b4a6330f9c3c0a46d96674e632df504b56b",
          tx,
          hex: "020000000135cb3d5e2f94a72aa6c5dbab298d3411a5a3c027788ee8e75c7484d2c0d504ad000000006a4730440220536f9c20c42cb50472d76fb20aa55d9f9996da0881e6f12be8ad6f657844f993022076bd3e01ab8d17eba22718d2be1cdd9649e61754651dda5e062d27540e789a4001210234ec664aae13ced11d4676d33c8603e01a2ba7c6acdbbe4097323f0c4744ad56feffffff02a086010000000000160014b31dc2a236505a6cb9201fa0411ca38a254a7bf101ba0d00000000001976a9148071b2af42e167ec58e422e784358ec71f80274b88ac5a241700",
        },
      ];
      const outputs: core.BTCSignTxOutput[] = [
        {
          address: "2N4Q5FhU2497BryFfUgbqkAJE87aKHUhXMp",
          addressType: core.BTCOutputAddressType.Spend,
          amount: String(50000),
          isChange: false,
        },
        {
          addressNList: core.bip32ToAddressNList("m/84'/1'/0'/1/0"),
          scriptType: core.BTCOutputScriptType.PayToWitness,
          addressType: core.BTCOutputAddressType.Change,
          amount: String(100000 - 1000 - 50000),
          isChange: true,
        },
      ];
      const res = await wallet.btcSignTx({
        coin: "Testnet",
        inputs: inputs as core.BTCSignTxInput[],
        outputs: outputs,
        version: 1,
        locktime: 0,
      });
      expect(res?.serializedTx).toEqual(
        "010000000001016bb504f52d634e67966da4c0c3f930634a3bda329881b58aa16e855941b2b5e40000000000ffffffff0250c300000000000017a9147a55d61848e77ca266e79a39bfc85c580a6426c98768bf000000000000160014cc8067093f6f843d6d3e22004a4290cd0c0f336b0247304402200f62d997b9dafe79a7a680626f4510a0b1be7a6e6b67607985e611f771c8acaf022009b3fb8ea7d8a80daa3e4cb44d51ba40289b049c59741e906424c55e90df9900012103adc58245cf28406af0ef5cc24b8afba7f1be6c72f279b642d85c48798685f86200000000"
      );
    });
  });
}
