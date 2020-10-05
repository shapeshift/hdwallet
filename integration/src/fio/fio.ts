import { bip32ToAddressNList, HDWallet, FioWallet, supportsFio } from "@shapeshiftoss/hdwallet-core";
import { FioActionParameters, PublicAddress } from "fiosdk-offline";

import { HDWalletInfo } from "@shapeshiftoss/hdwallet-core/src/wallet";
import * as tx01_unsigned from "./tx01.unsigned.json";
import * as tx02_signed from "./tx02.signed.json";

const MNEMONIC12_NOPIN_NOPASSPHRASE = "alcohol woman abuse must during monitor noble actual mixed trade anger aisle";
const MNEMONIC12_NOPIN_NOPASSPHRASE2 = "all all all all all all all all all all all all";

const TIMEOUT = 60 * 1000;

export function fioTests(get: () => { wallet: HDWallet; info: HDWalletInfo; wallet2: HDWallet }): void {
  let wallet: FioWallet & HDWallet;
  let wallet2: FioWallet & HDWallet;

  describe("Fio", () => {
    beforeAll(async () => {
      const { wallet: w } = get();
      const { wallet2: w2 } = get();
      if (supportsFio(w)) wallet = w;
      if (supportsFio(w2)) wallet2 = w2;
    });

    beforeEach(async () => {
      if (!wallet) return;
      if (!wallet2) return;
      await wallet.wipe();
      await wallet.loadDevice({
        mnemonic: MNEMONIC12_NOPIN_NOPASSPHRASE,
        label: "test",
        skipChecksum: true,
      });
      await wallet2.wipe();
      await wallet2.loadDevice({
        mnemonic: MNEMONIC12_NOPIN_NOPASSPHRASE2,
        label: "test2",
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
      "fioSignTransferTokenTx()",
      async () => {
        if (!wallet) return;
        const data: FioActionParameters.FioTransferTokensPubKeyActionData = {
          payee_public_key: "FIO7MpYCsLfjPGgXg8Sv7usGAw6RnFV3W6HTz1UP6HvodNXSAZiDp",
          amount: "1000000000",
          max_fee: 800000000000,
          tpid: "",
        };
        const res = await wallet.fioSignTx({
          addressNList: bip32ToAddressNList("m/44'/235'/0'/0/0"),
          actions: [
            {
              account: FioActionParameters.FioTransferTokensPubKeyActionAccount,
              name: FioActionParameters.FioTransferTokensPubKeyActionName,
              data,
            },
          ],
        });

        expect(res).toHaveProperty("signature");
        expect(res).toHaveProperty("serialized");
      },
      TIMEOUT
    );

    test(
      "fioSignAddPubAddressTx()",
      async () => {
        if (!wallet) return;
        const publicAddresses: PublicAddress[] = [
          {
            chain_code: "ETH",
            token_code: "ETH",
            public_address: "0x3f2329c9adfbccd9a84f52c906e936a42da18cb8",
          },
        ];
        const data: FioActionParameters.FioAddPubAddressActionData = {
          fio_address: "test@shapeshift",
          public_addresses: publicAddresses,
          max_fee: 800000000000,
          tpid: "",
        };
        const res = await wallet.fioSignTx({
          addressNList: bip32ToAddressNList("m/44'/235'/0'/0/0"),
          actions: [
            {
              account: FioActionParameters.FioAddPubAddressActionAccount,
              name: FioActionParameters.FioAddPubAddressActionName,
              data,
            },
          ],
        });

        expect(res).toHaveProperty("signature");
        expect(res).toHaveProperty("serialized");
      },
      TIMEOUT
    );

    test(
      "fioSignRegisterFioAddressTx()",
      async () => {
        if (!wallet) return;
        const data: FioActionParameters.FioRegisterFioAddressActionData = {
          fio_address: "test@shapeshift",
          owner_fio_public_key: "FIO7MpYCsLfjPGgXg8Sv7usGAw6RnFV3W6HTz1UP6HvodNXSAZiDp",
          max_fee: 800000000000,
          tpid: "",
        };
        const res = await wallet.fioSignTx({
          addressNList: bip32ToAddressNList("m/44'/235'/0'/0/0"),
          actions: [
            {
              account: FioActionParameters.FioRegisterFioAddressActionAccount,
              name: FioActionParameters.FioRegisterFioAddressActionName,
              data,
            },
          ],
        });

        expect(res).toHaveProperty("signature");
        expect(res).toHaveProperty("serialized");
      },
      TIMEOUT
    );

    test(
      "fioNewFundsRequestActionData()",
      async () => {
        if (!wallet) return;

        //TODO import content interface
        const originalContent: any = {
          payee_public_address: "test@shapeshift",
          amount: "1",
          chain_code: "FIO",
          token_code: "FIO",
          memo: "memo",
          hash: "hash",
          offline_url: "offline_url",
        };

        const data: FioActionParameters.FioNewFundsRequestActionData = {
          payer_fio_address: "test@shapeshift",
          payee_fio_address: "highlander@scatter",
          content: originalContent,
          max_fee: 2,
          tpid: "",
          actor: "",
        };
        const res = await wallet.fioSignTx({
          addressNList: bip32ToAddressNList("m/44'/235'/0'/0/0"),
          actions: [
            {
              account: FioActionParameters.FioNewFundsRequestActionAccount,
              name: FioActionParameters.FioNewFundsRequestActionName,
              data,
            },
          ],
        });

        expect(res).toHaveProperty("signature");
        expect(res).toHaveProperty("serialized");
      },
      TIMEOUT
    );

    test(
      "fioSignRegisterDomainTx()",
      async () => {
        if (!wallet) return;
        const data: FioActionParameters.FioRegisterFioDomainActionData = {
          fio_domain: "fox",
          owner_fio_public_key: "FIO7MpYCsLfjPGgXg8Sv7usGAw6RnFV3W6HTz1UP6HvodNXSAZiDp",
          max_fee: 800000000000,
          tpid: "",
        };
        const res = await wallet.fioSignTx({
          addressNList: bip32ToAddressNList("m/44'/235'/0'/0/0"),
          actions: [
            {
              account: FioActionParameters.FioRegisterFioDomainActionAccount,
              name: FioActionParameters.FioRegisterFioDomainActionName,
              data,
            },
          ],
        });

        expect(res).toHaveProperty("signature");
        expect(res).toHaveProperty("serialized");
      },
      TIMEOUT
    );

    test(
      "fioEncryptDecryptRequestContent()",
      async () => {
        if (!wallet) return;
        if (!wallet2) return;
        const originalContent: any = {
          payee_public_address: "purse.alice",
          amount: "1",
          chain_code: "FIO",
          token_code: "FIO",
          memo: "memo",
          hash: "hash",
          offline_url: "offline_url",
        };
        const walletPk = await wallet.fioGetAddress({
          addressNList: bip32ToAddressNList("m/44'/235'/0'/0/0"),
          showDisplay: false,
        });
        const wallet2Pk = await wallet2.fioGetAddress({
          addressNList: bip32ToAddressNList("m/44'/235'/0'/0/0"),
          showDisplay: false,
        });

        const encryptedContent = await wallet.fioEncryptRequestContent({
          addressNList: bip32ToAddressNList("m/44'/235'/0'/0/0"),
          content: originalContent,
          publicKey: wallet2Pk,
        });
        const decryptedContent = await wallet2.fioDecryptRequestContent({
          addressNList: bip32ToAddressNList("m/44'/235'/0'/0/0"),
          content: encryptedContent,
          publicKey: walletPk,
        });
        expect(originalContent).toEqual(decryptedContent);
      },
      TIMEOUT
    );
  });
}
