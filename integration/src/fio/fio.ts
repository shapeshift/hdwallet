import { bip32ToAddressNList, HDWallet, FioWallet, supportsFio, FioEncryptionContentType } from "@shapeshiftoss/hdwallet-core";
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

    /*
      Get FIO Address

     */
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

    /*
      Transfer FIO tokens

     */
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

    /*
      Add pubkey to FIO account

     */
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

    /*
      Register FIO address

     */
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

    /*
      Create payment request

     */
    test(
      "fioSignNewFundsRequestTx()",
      async () => {
        if (!wallet) return;

        const originalContent: FioActionParameters.FioRequestContent = {
          payee_public_address: "test@shapeshift",
          amount: "1",
          chain_code: "FIO",
          token_code: "FIO",
          memo: "memo",
          hash: "hash",
          offline_url: "offline_url",
        };

        const encryptedContent: string = await wallet.fioEncryptRequestContent({
          addressNList: bip32ToAddressNList("m/44'/235'/0'/0/0"),
          content: originalContent,
          publicKey: "FIO6Lxx7BTA8zbgPuqn4QidNNdTCHisXU7RpxJxLwxAka7NV7SoBW",
          contentType: FioEncryptionContentType.REQUEST
        });

        const data: FioActionParameters.FioNewFundsRequestActionData = {
          payer_fio_address: "highlander@scatter",
          payee_fio_address: "test@shapeshift",
          content: encryptedContent,
          max_fee: 800000000000,
          tpid: "",
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

    /*
      Accept payment request

     */
    test(
      "fioRecordObtDataTx()",
      async () => {
        if (!wallet) return;

        let content: FioActionParameters.FioObtDataContent = {
          payee_public_address: "test@shapeshift",
          payer_public_address: "highlander@scatter",
          amount: "1",
          chain_code: "FIO",
          token_code: "FIO",
          memo: "memo",
          hash: "hash",
          status: "",
          obt_id: "",
          offline_url: "offline_url",
        };

        const data: FioActionParameters.FioRecordObtDataActionData = {
          payee_fio_address: "test@shapeshift",
          payer_fio_address: "highlander@scatter",
          content: content,
          fio_request_id: "17501",
          max_fee: 800000000000,
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

    /*
      Reject payment request

     */
    test(
      "fioRejectFundsRequestTx()",
      async () => {
        if (!wallet) return;

        const data: FioActionParameters.FioRejectFundsRequestActionData = {
          fio_request_id: "17501",
          max_fee: 800000000000,
          tpid: "",
        };

        const res = await wallet.fioSignTx({
          addressNList: bip32ToAddressNList("m/44'/235'/0'/0/0"),
          actions: [
            {
              account: FioActionParameters.FioRejectFundsRequestActionAccount,
              name: FioActionParameters.FioRejectFundsRequestActionName,
              data,
            },
          ],
        });

        expect(res).toHaveProperty("signature");
        expect(res).toHaveProperty("serialized");
      },
      TIMEOUT
    );

    /*
      Register FIO domain

     */
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

    /*
      Encrypt/decrypt request content object

     */
    test(
      "fioEncryptDecryptRequestContent()",
      async () => {
        if (!wallet) return;
        if (!wallet2) return;
        const originalContent: FioActionParameters.FioRequestContent = {
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
          contentType: FioEncryptionContentType.REQUEST
        });
        const decryptedContent = await wallet2.fioDecryptRequestContent({
          addressNList: bip32ToAddressNList("m/44'/235'/0'/0/0"),
          content: encryptedContent,
          publicKey: walletPk,
          contentType: FioEncryptionContentType.REQUEST
        });
        expect(originalContent).toEqual(decryptedContent);
      },
      TIMEOUT
    )

    test(
      "fioEncryptDecryptObtContent()",
      async () => {
        if (!wallet) return;
        if (!wallet2) return;
        const originalContent: FioActionParameters.FioObtDataContent = {
          payee_public_address: "purse.alice",
          payer_public_address: "purse.bob",
          amount: "1",
          chain_code: "FIO",
          token_code: "FIO",
          status: "status",
          obt_id: "0x12345",
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
          contentType: FioEncryptionContentType.OBT
        });
        const decryptedContent = await wallet2.fioDecryptRequestContent({
          addressNList: bip32ToAddressNList("m/44'/235'/0'/0/0"),
          content: encryptedContent,
          publicKey: walletPk,
          contentType: FioEncryptionContentType.OBT
        });
        expect(originalContent).toEqual(decryptedContent);
      },
      TIMEOUT
    )
  });
}
