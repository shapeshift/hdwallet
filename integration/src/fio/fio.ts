import { bip32ToAddressNList, HDWallet, FioWallet, supportsFio } from "@shapeshiftoss/hdwallet-core";

import { HDWalletInfo } from "@shapeshiftoss/hdwallet-core/src/wallet";

import * as tx01_unsigned from "./tx01.unsigned.json";
import * as tx02_unsigned from "./tx02.unsigned.json";

const MNEMONIC12_NOPIN_NOPASSPHRASE = "alcohol woman abuse must during monitor noble actual mixed trade anger aisle";

const TIMEOUT = 60 * 1000;

export function fioTests(get: () => { wallet: HDWallet; info: HDWalletInfo }): void {
  let wallet: FioWallet & HDWallet;

  describe("Fio", () => {
    beforeAll(async () => {
      const { wallet: w } = get();
      if (supportsFio(w)) wallet = w;
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
      "fioGetAddress()",
      async () => {
        if (!wallet) return;
        expect(
          await wallet.fioGetAddress({
            addressNList: bip32ToAddressNList("m/44'/235'/0'/0/0"),
            showDisplay: false,
          })
        ).toEqual("FIO6iLE1J4zb2SyDGTH9d6UL9Qm6hhqRce27QvP8AKxVLASGhtm7z");
      },
      TIMEOUT
    );

    test(
      "fioSignTx()",
      async () => {
        if (!wallet) return;
        let res = await wallet.fioSignTx({
          actions: [
            {
              account: "fio.token",
              name: "trnsfiopubky",
              data: {
                payee_public_key: "FIO7MpYCsLfjPGgXg8Sv7usGAw6RnFV3W6HTz1UP6HvodNXSAZiDp",
                amount: "1000000000",
                max_fee: 800000000000,
                tpid: "",
              },
            },
          ],
        });
        expect(res).toHaveProperty(
          "signatures",
          "SIG_K1_KZQX5nQDier8wtNRCQakgVRLVoZuRBFqGz8H7qxzDX2v2XJcaEVfa7xuZ9yX9CVqkpHaHVMBF4P2sp1GnZDYE15kJNK3aN"
        );
        expect(res).toHaveProperty("compression", 0);
        expect(res).toHaveProperty("packed_context_free_data", "");
        expect(res).toHaveProperty("packed_trx");
      },
      TIMEOUT
    );
  });
}
