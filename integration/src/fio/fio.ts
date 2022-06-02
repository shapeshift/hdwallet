import * as core from "@shapeshiftoss/hdwallet-core";

// TODO: Use these test TXs for something?
// import * as tx01_unsigned from "./tx01.unsigned.json";
// import * as tx02_signed from "./tx02.signed.json";

const MNEMONIC12_NOPIN_NOPASSPHRASE = "alcohol woman abuse must during monitor noble actual mixed trade anger aisle";
const MNEMONIC12_NOPIN_NOPASSPHRASE2 = "all all all all all all all all all all all all";

const TIMEOUT = 60 * 1000;

export function fioTests(get: () => { wallet: core.HDWallet; info: core.HDWalletInfo; wallet2: core.HDWallet }): void {
  let wallet: core.FioWallet & core.HDWallet;
  let wallet2: core.FioWallet & core.HDWallet;

  describe("Fio", () => {
    beforeAll(async () => {
      const { wallet: w, wallet2: w2 } = get();
      if (core.supportsFio(w)) wallet = w;
      if (core.supportsFio(w2)) wallet2 = w2;
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
        await expect(
          wallet.fioGetAddress({
            addressNList: core.bip32ToAddressNList("m/44'/235'/0'/0/0"),
            showDisplay: false,
          })
        ).resolves.toEqual("FIO6iLE1J4zb2SyDGTH9d6UL9Qm6hhqRce27QvP8AKxVLASGhtm7z");

        if (!wallet2) return;
        await expect(
          wallet2.fioGetAddress({
            addressNList: core.bip32ToAddressNList("m/44'/235'/0'/0/0"),
            showDisplay: false,
          })
        ).resolves.toEqual("FIO5NSKecB4CcMpUxtpHzG4u43SmcGMAjRbxyG38rE4HPegGpaHu9");
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
        const res = await wallet.fioSignTx({
          addressNList: core.bip32ToAddressNList("m/44'/235'/0'/0/0"),
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
        const res = await wallet.fioSignTx({
          addressNList: core.bip32ToAddressNList("m/44'/235'/0'/0/0"),
          actions: [
            {
              account: "fio.address",
              name: "addaddress",
              data: {
                fio_address: "test@shapeshift",
                public_addresses: [
                  {
                    chain_code: "ETH",
                    token_code: "ETH",
                    public_address: "0x3f2329c9adfbccd9a84f52c906e936a42da18cb8",
                  },
                ],
                max_fee: 800000000000,
                tpid: "",
              },
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
        const res = await wallet.fioSignTx({
          addressNList: core.bip32ToAddressNList("m/44'/235'/0'/0/0"),
          actions: [
            {
              account: "fio.address",
              name: "regaddress",
              data: {
                fio_address: "test@shapeshift",
                owner_fio_public_key: "FIO7MpYCsLfjPGgXg8Sv7usGAw6RnFV3W6HTz1UP6HvodNXSAZiDp",
                max_fee: 800000000000,
                tpid: "",
              },
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

        const res = await wallet.fioSignTx({
          addressNList: core.bip32ToAddressNList("m/44'/235'/0'/0/0"),
          actions: [
            {
              account: "fio.reqobt",
              name: "newfundsreq",
              data: {
                payer_fio_address: "highlander@scatter",
                payee_fio_address: "test@shapeshift",
                content: core.mustBeDefined(
                  await wallet.fioEncryptRequestContent({
                    addressNList: core.bip32ToAddressNList("m/44'/235'/0'/0/0"),
                    content: {
                      payee_public_address: "test@shapeshift",
                      amount: "1",
                      chain_code: "FIO",
                      token_code: "FIO",
                      memo: "memo",
                      hash: "hash",
                      offline_url: "offline_url",
                    },
                    publicKey: "FIO6Lxx7BTA8zbgPuqn4QidNNdTCHisXU7RpxJxLwxAka7NV7SoBW",
                    contentType: core.FioEncryptionContentType.REQUEST,
                  })
                ),
                max_fee: 800000000000,
                tpid: "",
              },
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

        const res = await wallet.fioSignTx({
          addressNList: core.bip32ToAddressNList("m/44'/235'/0'/0/0"),
          actions: [
            {
              account: "fio.reqobt",
              name: "recordobt",
              data: {
                payee_fio_address: "test@shapeshift",
                payer_fio_address: "highlander@scatter",
                content: core.mustBeDefined(
                  await wallet.fioEncryptRequestContent({
                    addressNList: core.bip32ToAddressNList("m/44'/235'/0'/0/0"),
                    content: {
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
                    },
                    publicKey: "FIO6iLE1J4zb2SyDGTH9d6UL9Qm6hhqRce27QvP8AKxVLASGhtm7z",
                    contentType: core.FioEncryptionContentType.OBT,
                  })
                ),
                fio_request_id: "17501",
                max_fee: 800000000000,
                tpid: "",
                actor: "",
              },
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

        const res = await wallet.fioSignTx({
          addressNList: core.bip32ToAddressNList("m/44'/235'/0'/0/0"),
          actions: [
            {
              account: "fio.reqobt",
              name: "rejectfndreq",
              data: {
                fio_request_id: "17501",
                max_fee: 800000000000,
                tpid: "",
              },
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
        const res = await wallet.fioSignTx({
          addressNList: core.bip32ToAddressNList("m/44'/235'/0'/0/0"),
          actions: [
            {
              account: "fio.address",
              name: "regdomain",
              data: {
                fio_domain: "fox",
                owner_fio_public_key: "FIO7MpYCsLfjPGgXg8Sv7usGAw6RnFV3W6HTz1UP6HvodNXSAZiDp",
                max_fee: 800000000000,
                tpid: "",
              },
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
        const originalContent = {
          payee_public_address: "purse.alice",
          amount: "1",
          chain_code: "FIO",
          token_code: "FIO",
          memo: "memo",
          hash: "hash",
          offline_url: "offline_url",
        };
        const walletPk = core.mustBeDefined(
          await wallet.fioGetAddress({
            addressNList: core.bip32ToAddressNList("m/44'/235'/0'/0/0"),
            showDisplay: false,
          })
        );
        const wallet2Pk = core.mustBeDefined(
          await wallet2.fioGetAddress({
            addressNList: core.bip32ToAddressNList("m/44'/235'/0'/0/0"),
            showDisplay: false,
          })
        );

        const encryptedContent = core.mustBeDefined(
          await wallet.fioEncryptRequestContent({
            addressNList: core.bip32ToAddressNList("m/44'/235'/0'/0/0"),
            content: originalContent,
            publicKey: wallet2Pk,
            contentType: core.FioEncryptionContentType.REQUEST,
          })
        );
        const decryptedContent = core.mustBeDefined(
          await wallet2.fioDecryptRequestContent({
            addressNList: core.bip32ToAddressNList("m/44'/235'/0'/0/0"),
            content: encryptedContent,
            publicKey: walletPk,
            contentType: core.FioEncryptionContentType.REQUEST,
          })
        );
        expect(originalContent).toEqual(decryptedContent);
      },
      TIMEOUT
    );

    test(
      "fioEncryptDecryptObtContent()",
      async () => {
        if (!wallet) return;
        if (!wallet2) return;
        const originalContent = {
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
        const walletPk = core.mustBeDefined(
          await wallet.fioGetAddress({
            addressNList: core.bip32ToAddressNList("m/44'/235'/0'/0/0"),
            showDisplay: false,
          })
        );
        const wallet2Pk = core.mustBeDefined(
          await wallet2.fioGetAddress({
            addressNList: core.bip32ToAddressNList("m/44'/235'/0'/0/0"),
            showDisplay: false,
          })
        );

        const encryptedContent = core.mustBeDefined(
          await wallet.fioEncryptRequestContent({
            addressNList: core.bip32ToAddressNList("m/44'/235'/0'/0/0"),
            content: originalContent,
            publicKey: wallet2Pk,
            contentType: core.FioEncryptionContentType.OBT,
          })
        );
        const decryptedContent = core.mustBeDefined(
          await wallet2.fioDecryptRequestContent({
            addressNList: core.bip32ToAddressNList("m/44'/235'/0'/0/0"),
            content: encryptedContent,
            publicKey: walletPk,
            contentType: core.FioEncryptionContentType.OBT,
          })
        );
        expect(originalContent).toEqual(decryptedContent);
      },
      TIMEOUT
    );
  });
}
