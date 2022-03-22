import * as core from "@shapeshiftoss/hdwallet-core";
import * as ledger from "@shapeshiftoss/hdwallet-ledger";
import * as native from "@shapeshiftoss/hdwallet-native";
import * as portis from "@shapeshiftoss/hdwallet-portis";
import * as trezor from "@shapeshiftoss/hdwallet-trezor";

import { each } from "../utils";

const MNEMONIC12_NOPIN_NOPASSPHRASE = "alcohol woman abuse must during monitor noble actual mixed trade anger aisle";

const TIMEOUT = 60 * 1000;

function deepFreeze<T extends Record<string, unknown>>(object: T): T {
  const propNames = Object.getOwnPropertyNames(object);
  for (const name of propNames) {
    const value = object[name];

    if (value && typeof value === "object") {
      deepFreeze(value as Record<string, unknown>);
    }
  }
  return Object.freeze(object);
}

/**
 *  Main integration suite for testing BTCWallet implementations' Bitcoin support.
 */
export function bitcoinTests(get: () => { wallet: core.HDWallet; info: core.HDWalletInfo }): void {
  let wallet: core.BTCWallet & core.HDWallet;
  let info: core.BTCWalletInfo;

  describe("Bitcoin", () => {
    beforeAll(() => {
      const { wallet: w, info: i } = get();

      if (core.supportsBTC(w)) {
        wallet = w;
        if (!core.infoBTC(i)) {
          throw new Error("wallet info does not _supportsBTCInfo?");
        }
        info = i;
      }
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

    test("isInitialized()", async () => {
      if (!wallet) return;
      expect(await wallet.isInitialized()).toBeTruthy();
    });

    test(
      "btcSupportsCoin()",
      async () => {
        if (!wallet || portis.isPortis(wallet)) return;
        expect(wallet.btcSupportsCoin("Bitcoin")).toBeTruthy();
        expect(await info.btcSupportsCoin("Bitcoin")).toBeTruthy();
        expect(wallet.btcSupportsCoin("Testnet")).toBeTruthy();
        expect(await info.btcSupportsCoin("Testnet")).toBeTruthy();
      },
      TIMEOUT
    );

    test("getPublicKeys", async () => {
      if (!wallet || ledger.isLedger(wallet) || trezor.isTrezor(wallet) || portis.isPortis(wallet)) return;

      /* FIXME: Expected failure (trezor does not use scriptType in deriving public keys
          and ledger's dependency bitcoinjs-lib/src/crypto.js throws a mysterious TypeError
          in between mock transport calls.
       */
      expect(
        await wallet.getPublicKeys([
          {
            coin: "Bitcoin",
            addressNList: core.bip32ToAddressNList(`m/44'/0'/0'`),
            curve: "secp256k1",
          },
          {
            coin: "Bitcoin",
            addressNList: core.bip32ToAddressNList(`m/49'/0'/0'`),
            curve: "secp256k1",
            scriptType: core.BTCInputScriptType.SpendAddress,
          },
          {
            coin: "Bitcoin",
            addressNList: core.bip32ToAddressNList(`m/49'/0'/0'`),
            curve: "secp256k1",
            scriptType: core.BTCInputScriptType.SpendP2SHWitness,
          },
          {
            coin: "Bitcoin",
            addressNList: core.bip32ToAddressNList(`m/49'/0'/0'`),
            curve: "secp256k1",
            scriptType: core.BTCInputScriptType.SpendAddress,
          },
          {
            coin: "Bitcoin",
            addressNList: core.bip32ToAddressNList(`m/84'/0'/0'`),
            curve: "secp256k1",
            scriptType: core.BTCInputScriptType.SpendWitness,
          },
          {
            coin: "Bitcoin",
            addressNList: core.bip32ToAddressNList(`m/0'/0'/0'`),
            curve: "secp256k1",
            scriptType: core.BTCInputScriptType.SpendAddress,
          },
          {
            coin: "Litecoin",
            addressNList: core.bip32ToAddressNList(`m/0'/0'/0'`),
            curve: "secp256k1",
            scriptType: core.BTCInputScriptType.SpendAddress,
          },
        ])
      ).toEqual([
        {
          xpub: "xpub6D1weXBcFAo8CqBbpP4TbH5sxQH8ZkqC5pDEvJ95rNNBZC9zrKmZP2fXMuve7ZRBe18pWQQsGg68jkq24mZchHwYENd8cCiSb71u3KD4AFH",
        },
        {
          xpub: "xpub6DExuxjQ16sWy5TF4KkLV65YGqCJ5pyv7Ej7d9yJNAXz7C1M9intqszXfaNZG99KsDJdQ29wUKBTZHZFXUaPbKTZ5Z6f4yowNvAQ8fEJw2G",
        },
        {
          xpub: "ypub6Y5EDdQK9nQzpNeMtgXxhBB3SoLk2SyR2MFLQYsBkAusAHpaQNxTTwefgnL9G3oFGrRS9VkVvyY1SaApFAzQPZ99wto5etdReeE3XFkkMZt",
        },
        {
          xpub: "xpub6DExuxjQ16sWy5TF4KkLV65YGqCJ5pyv7Ej7d9yJNAXz7C1M9intqszXfaNZG99KsDJdQ29wUKBTZHZFXUaPbKTZ5Z6f4yowNvAQ8fEJw2G",
        },
        {
          xpub: "zpub6qSSRL9wLd6LNee7qjDEuULWccP5Vbm5nuX4geBu8zMCQBWsF5Jo5UswLVxFzcbCMr2yQPG27ZhDs1cUGKVH1RmqkG1PFHkEXyHG7EV3ogY",
        },
        {
          xpub: "xpub6Bge9YGd4gjuSaNXdQi4vgvK8iErStBKbESBzAs6tVHBBpsqeCHEVBVgQE7P3W53XKR454adsrg3mccVCzGzcTyVEq9a3QhHsLcs65Tck9U",
        },
        {
          xpub: "Ltub2Y7kcBUex83ugweUDti4nZ2YDWZRCfhTiWeApFcDFz7svCWeJCmyJpz7m6dQhuUJ7XpdfByBitKRshyc7tNSTPkuXy32i6TLMqPCzbm7r8s",
        },
      ]);
    });

    test(
      "btcGetAddress()",
      async () => {
        if (!wallet || portis.isPortis(wallet)) return;
        await each(
          [
            [
              "Show",
              "Bitcoin",
              "m/44'/0'/0'/0/0",
              core.BTCInputScriptType.SpendAddress,
              "1FH6ehAd5ZFXCM1cLGzHxK1s4dGdq1JusM",
            ],
            [
              "Show",
              "Bitcoin",
              "m/49'/0'/0'/0/0",
              core.BTCInputScriptType.SpendP2SHWitness,
              "3AnYTd2FGxJLNKL1AzxfW3FJMntp9D2KKX",
            ],
            [
              "Tell",
              "Bitcoin",
              "m/49'/0'/0'/0/0",
              core.BTCInputScriptType.SpendP2SHWitness,
              "3AnYTd2FGxJLNKL1AzxfW3FJMntp9D2KKX",
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
              "Dash",
              "m/44'/5'/0'/0/0",
              core.BTCInputScriptType.SpendAddress,
              "XxKhGNv6ECbqVswm9KYcLPQnyWgZ86jJ6Q",
            ],
          ],
          async (args) => {
            const mode = args[0] as string;
            const coin = args[1] as core.Coin;
            const path = args[2] as string;
            const scriptType = args[3] as core.BTCInputScriptType;
            const expected = args[4] as string;

            if (!(await wallet.btcSupportsCoin(coin))) return;
            expect(await info.btcSupportsCoin(coin)).toBeTruthy();
            if (!(await wallet.btcSupportsScriptType(coin, scriptType))) return;
            expect(await info.btcSupportsScriptType(coin, scriptType)).toBeTruthy();
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
      "btcSignTx() - p2pkh",
      async () => {
        if (!wallet || portis.isPortis(wallet)) return;
        if (ledger.isLedger(wallet)) return; // FIXME: Expected failure
        const tx: core.BitcoinTx = {
          version: 1,
          locktime: 0,
          vin: [
            {
              vout: 1,
              sequence: 4294967295,
              scriptSig: {
                hex: "483045022072ba61305fe7cb542d142b8f3299a7b10f9ea61f6ffaab5dca8142601869d53c0221009a8027ed79eb3b9bc13577ac2853269323434558528c6b6a7e542be46e7e9a820141047a2d177c0f3626fc68c53610b0270fa6156181f46586c679ba6a88b34c6f4874686390b4d92e5769fbb89c8050b984f4ec0b257a0e5c4ff8bd3b035a51709503",
              },
              txid: "c16a03f1cf8f99f6b5297ab614586cacec784c2d259af245909dedb0e39eddcf",
            },
            {
              vout: 1,
              sequence: 4294967295,
              scriptSig: {
                hex: "48304502200fd63adc8f6cb34359dc6cca9e5458d7ea50376cbd0a74514880735e6d1b8a4c0221008b6ead7fe5fbdab7319d6dfede3a0bc8e2a7c5b5a9301636d1de4aa31a3ee9b101410486ad608470d796236b003635718dfc07c0cac0cfc3bfc3079e4f491b0426f0676e6643a39198e8e7bdaffb94f4b49ea21baa107ec2e237368872836073668214",
              },
              txid: "1ae39a2f8d59670c8fc61179148a8e61e039d0d9e8ab08610cb69b4a19453eaf",
            },
          ],
          vout: [
            {
              value: "0.00390000",
              scriptPubKey: {
                hex: "76a91424a56db43cf6f2b02e838ea493f95d8d6047423188ac",
              },
            },
          ],
        };
        const inputs: core.BTCSignTxInputUnguarded[] = [
          {
            addressNList: core.bip32ToAddressNList("m/0"),
            scriptType: core.BTCInputScriptType.SpendAddress,
            amount: String(390000),
            vout: 0,
            txid: "d5f65ee80147b4bcc70b75e4bbf2d7382021b871bd8867ef8fa525ef50864882",
            tx,
            hex: "0100000002cfdd9ee3b0ed9d9045f29a252d4c78ecac6c5814b67a29b5f6998fcff1036ac1010000008b483045022072ba61305fe7cb542d142b8f3299a7b10f9ea61f6ffaab5dca8142601869d53c0221009a8027ed79eb3b9bc13577ac2853269323434558528c6b6a7e542be46e7e9a820141047a2d177c0f3626fc68c53610b0270fa6156181f46586c679ba6a88b34c6f4874686390b4d92e5769fbb89c8050b984f4ec0b257a0e5c4ff8bd3b035a51709503ffffffffaf3e45194a9bb60c6108abe8d9d039e0618e8a147911c68f0c67598d2f9ae31a010000008b48304502200fd63adc8f6cb34359dc6cca9e5458d7ea50376cbd0a74514880735e6d1b8a4c0221008b6ead7fe5fbdab7319d6dfede3a0bc8e2a7c5b5a9301636d1de4aa31a3ee9b101410486ad608470d796236b003635718dfc07c0cac0cfc3bfc3079e4f491b0426f0676e6643a39198e8e7bdaffb94f4b49ea21baa107ec2e237368872836073668214ffffffff0170f30500000000001976a91424a56db43cf6f2b02e838ea493f95d8d6047423188ac00000000",
          },
        ];
        const outputs: core.BTCSignTxOutput[] = [
          {
            address: "1MJ2tj2ThBE62zXbBYA5ZaN3fdve5CPAz1",
            addressType: core.BTCOutputAddressType.Spend,
            // scriptType: core.BTCOutputScriptType.PayToAddress,
            amount: String(390000 - 10000),
            isChange: false,
          },
        ];
        const res = await wallet.btcSignTx(
          deepFreeze({
            coin: "Bitcoin",
            inputs: inputs as core.BTCSignTxInput[],
            outputs,
            version: 1,
            locktime: 0,
          })
        );
        expect(res).toEqual({
          serializedTx:
            "010000000182488650ef25a58fef6788bd71b8212038d7f2bbe4750bc7bcb44701e85ef6d5000000006b4830450221009a0b7be0d4ed3146ee262b42202841834698bb3ee39c24e7437df208b8b7077102202b79ab1e7736219387dffe8d615bbdba87e11477104b867ef47afed1a5ede7810121023230848585885f63803a0a8aecdd6538792d5c539215c91698e315bf0253b43dffffffff0160cc0500000000001976a914de9b2a8da088824e8fe51debea566617d851537888ac00000000",
          signatures: [
            "30450221009a0b7be0d4ed3146ee262b42202841834698bb3ee39c24e7437df208b8b7077102202b79ab1e7736219387dffe8d615bbdba87e11477104b867ef47afed1a5ede781",
          ],
        });
      },
      TIMEOUT
    );

    test(
      "btcSignTx() - thorchain swap",
      async () => {
        if (!wallet || portis.isPortis(wallet)) return;
        if (ledger.isLedger(wallet)) return; // FIXME: Expected failure
        if (trezor.isTrezor(wallet)) return; //TODO: Add trezor support for op return data passed at top level
        const tx: core.BitcoinTx = {
          version: 1,
          locktime: 0,
          vin: [
            {
              vout: 1,
              sequence: 4294967295,
              scriptSig: {
                hex: "483045022072ba61305fe7cb542d142b8f3299a7b10f9ea61f6ffaab5dca8142601869d53c0221009a8027ed79eb3b9bc13577ac2853269323434558528c6b6a7e542be46e7e9a820141047a2d177c0f3626fc68c53610b0270fa6156181f46586c679ba6a88b34c6f4874686390b4d92e5769fbb89c8050b984f4ec0b257a0e5c4ff8bd3b035a51709503",
              },
              txid: "c16a03f1cf8f99f6b5297ab614586cacec784c2d259af245909dedb0e39eddcf",
            },
            {
              vout: 1,
              sequence: 4294967295,
              scriptSig: {
                hex: "48304502200fd63adc8f6cb34359dc6cca9e5458d7ea50376cbd0a74514880735e6d1b8a4c0221008b6ead7fe5fbdab7319d6dfede3a0bc8e2a7c5b5a9301636d1de4aa31a3ee9b101410486ad608470d796236b003635718dfc07c0cac0cfc3bfc3079e4f491b0426f0676e6643a39198e8e7bdaffb94f4b49ea21baa107ec2e237368872836073668214",
              },
              txid: "1ae39a2f8d59670c8fc61179148a8e61e039d0d9e8ab08610cb69b4a19453eaf",
            },
          ],
          vout: [
            {
              value: "0.00390000",
              scriptPubKey: {
                hex: "76a91424a56db43cf6f2b02e838ea493f95d8d6047423188ac",
              },
            },
          ],
        };
        const inputs: core.BTCSignTxInputUnguarded[] = [
          {
            addressNList: core.bip32ToAddressNList("m/0"),
            scriptType: core.BTCInputScriptType.SpendAddress,
            amount: String(390000),
            vout: 0,
            txid: "d5f65ee80147b4bcc70b75e4bbf2d7382021b871bd8867ef8fa525ef50864882",
            tx,
            hex: "0100000002cfdd9ee3b0ed9d9045f29a252d4c78ecac6c5814b67a29b5f6998fcff1036ac1010000008b483045022072ba61305fe7cb542d142b8f3299a7b10f9ea61f6ffaab5dca8142601869d53c0221009a8027ed79eb3b9bc13577ac2853269323434558528c6b6a7e542be46e7e9a820141047a2d177c0f3626fc68c53610b0270fa6156181f46586c679ba6a88b34c6f4874686390b4d92e5769fbb89c8050b984f4ec0b257a0e5c4ff8bd3b035a51709503ffffffffaf3e45194a9bb60c6108abe8d9d039e0618e8a147911c68f0c67598d2f9ae31a010000008b48304502200fd63adc8f6cb34359dc6cca9e5458d7ea50376cbd0a74514880735e6d1b8a4c0221008b6ead7fe5fbdab7319d6dfede3a0bc8e2a7c5b5a9301636d1de4aa31a3ee9b101410486ad608470d796236b003635718dfc07c0cac0cfc3bfc3079e4f491b0426f0676e6643a39198e8e7bdaffb94f4b49ea21baa107ec2e237368872836073668214ffffffff0170f30500000000001976a91424a56db43cf6f2b02e838ea493f95d8d6047423188ac00000000",
          },
        ];
        const outputs: core.BTCSignTxOutput[] = [
          {
            address: "bc1qksxqxurvejkndenuv0alqawpr3e4vtqkn246cu",
            addressType: core.BTCOutputAddressType.Spend,
            amount: String(390000 - 10000),
            isChange: false,
          },
          {
            addressNList: core.bip32ToAddressNList("m/44'/0'/0'/0/0"),
            addressType: core.BTCOutputAddressType.Change,
            scriptType: core.BTCOutputScriptType.PayToAddress,
            amount: String(9000),
            isChange: true,
          },
        ];

        const res = await wallet.btcSignTx(
          deepFreeze({
            coin: "Bitcoin",
            inputs: inputs as core.BTCSignTxInput[],
            outputs,
            version: 1,
            locktime: 0,
            vaultAddress: "bc1qksxqxurvejkndenuv0alqawpr3e4vtqkn246cu",
            opReturnData: "SWAP:ETH.ETH:0x931D387731bBbC988B312206c74F77D004D6B84b:420",
          })
        );
        expect(res).toEqual({
          serializedTx:
            "010000000182488650ef25a58fef6788bd71b8212038d7f2bbe4750bc7bcb44701e85ef6d5000000006a47304402207eee02e732e17618c90f8fdcaf3da24e2cfe2fdd6e37094b73f225360029515002205c29f80efc0bc077fa63633ff9ce2c44e0f109f70221a91afb7c531cdbb6305c0121023230848585885f63803a0a8aecdd6538792d5c539215c91698e315bf0253b43dffffffff0360cc050000000000160014b40c03706cccad36e67c63fbf075c11c73562c1628230000000000001976a9149c9d21f47382762df3ad81391ee0964b28dd951788ac00000000000000003d6a3b535741503a4554482e4554483a3078393331443338373733316242624339383842333132323036633734463737443030344436423834623a34323000000000",
          signatures: [
            "304402207eee02e732e17618c90f8fdcaf3da24e2cfe2fdd6e37094b73f225360029515002205c29f80efc0bc077fa63633ff9ce2c44e0f109f70221a91afb7c531cdbb6305c",
          ],
        });
      },
      TIMEOUT
    );

    test(
      "btcSignMessage()",
      async () => {
        if (!wallet) return;

        // not implemented for native
        if (native.isNative(wallet)) {
          return;
        }

        const res = wallet.btcSignMessage({
          addressNList: core.bip32ToAddressNList("m/44'/0'/0'/0/0"),
          coin: "Bitcoin",
          scriptType: core.BTCInputScriptType.SpendAddress,
          message: "Hello World",
        });

        // not implemented on portis
        if (portis.isPortis(wallet)) {
          // eslint-disable-next-line jest/no-conditional-expect
          await expect(res).rejects.toThrowError("not supported");
          return;
        }

        await expect(res).resolves.toEqual({
          address: "1FH6ehAd5ZFXCM1cLGzHxK1s4dGdq1JusM",
          signature:
            "20a037c911044cd6c851b6508317d8892067b0b62074b2cf1c0df9abd4aa053a3c243ffdc37f64d7af2c857128eafc81947c380995596615e5dcc313a15f512cdd",
        });
      },
      TIMEOUT
    );

    test(
      "btcVerifyMessage() - good",
      async () => {
        if (!wallet) return;

        // not implemented for native
        if (native.isNative(wallet)) {
          return;
        }

        const res = await wallet.btcVerifyMessage({
          address: "1FH6ehAd5ZFXCM1cLGzHxK1s4dGdq1JusM",
          coin: "Bitcoin",
          signature:
            "20a037c911044cd6c851b6508317d8892067b0b62074b2cf1c0df9abd4aa053a3c243ffdc37f64d7af2c857128eafc81947c380995596615e5dcc313a15f512cdd",
          message: "Hello World",
        });

        expect(res).toBeTruthy();
      },
      TIMEOUT
    );

    test(
      "btcVerifyMessage() - bad",
      async () => {
        if (!wallet) return;

        // not implemented for native
        if (native.isNative(wallet)) {
          return;
        }

        const res = await wallet.btcVerifyMessage({
          address: "1FH6ehAd5ZFXCM1cLGzHxK1s4dGdq1JusM",
          coin: "Bitcoin",
          signature:
            "20a037c911044cd6c851b6508317d8892067b0b62074b2cf1c0df9abd4aa053a3c243ffdc37f64d7af2c857128eafc81947c380995596615e5dcc313a15f512cdd",
          message: "Fake World",
        });

        expect(res).toBeFalsy();
      },
      TIMEOUT
    );

    test(
      "btcSupportsSecureTransfer()",
      async () => {
        if (!wallet) return;
        expect(typeof (await wallet.btcSupportsSecureTransfer()) === typeof true).toBeTruthy();
        if (await wallet.btcSupportsSecureTransfer()) {
          // eslint-disable-next-line jest/no-conditional-expect
          expect(await info.btcSupportsSecureTransfer()).toBeTruthy();
        }
        // TODO: write a testcase that exercise secure transfer, if the wallet claims to support it.
      },
      TIMEOUT
    );

    test(
      "btcSupportsNativeShapeShift()",
      async () => {
        if (!wallet) return;
        expect(typeof wallet.btcSupportsNativeShapeShift()).toBe("boolean");
        if (wallet.btcSupportsNativeShapeShift()) {
          // eslint-disable-next-line jest/no-conditional-expect
          expect(info.btcSupportsNativeShapeShift()).toBeTruthy();
        }
        // TODO: write a testcase that exercises native shapeshift, if the wallet claims to support it.
      },
      TIMEOUT
    );

    test(
      "btcGetAccountPaths()",
      async () => {
        await each(
          [
            ["Bitcoin", 0, undefined],
            ["Bitcoin", 1, core.BTCInputScriptType.SpendAddress],
            ["Bitcoin", 3, core.BTCInputScriptType.SpendP2SHWitness],
            ["Bitcoin", 2, core.BTCInputScriptType.SpendWitness],
            ["Litecoin", 1, core.BTCInputScriptType.SpendAddress],
            ["Litecoin", 1, core.BTCInputScriptType.SpendP2SHWitness],
            ["Dash", 0, core.BTCInputScriptType.SpendAddress],
            ["Dogecoin", 0, core.BTCInputScriptType.SpendAddress],
            ["BitcoinCash", 0, core.BTCInputScriptType.SpendAddress],
            ["BitcoinGold", 0, core.BTCInputScriptType.SpendAddress],
          ],
          async (args) => {
            const coin = args[0] as core.Coin;
            const accountIdx = args[1] as number;
            const scriptType = args[2] as core.BTCInputScriptType;
            if (!wallet) return;
            if (!(await wallet.btcSupportsCoin(coin))) return;
            expect(await info.btcSupportsCoin(coin)).toBeTruthy();
            if (!(await wallet.btcSupportsScriptType(coin, scriptType))) return;
            expect(await info.btcSupportsScriptType(coin, scriptType)).toBeTruthy();
            const paths = wallet.btcGetAccountPaths({
              coin: coin,
              accountIdx: accountIdx,
              scriptType: scriptType,
            });
            expect(paths.length > 0).toBeTruthy();
            if (scriptType !== undefined)
              // eslint-disable-next-line jest/no-conditional-expect
              expect(
                paths.filter((path) => {
                  return path.scriptType !== scriptType;
                })
              ).toHaveLength(0);
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
            coin: "Bitcoin",
            accountIdx: idx,
          });
          expect(typeof wallet.btcIsSameAccount(paths) === typeof true).toBeTruthy();
          paths.forEach((path) => {
            if (wallet.getVendor() === "Portis") {
              // eslint-disable-next-line jest/no-conditional-expect
              expect(wallet.btcNextAccountPath(path)).toBeUndefined();
            } else {
              // eslint-disable-next-line jest/no-conditional-expect
              expect(wallet.btcNextAccountPath(path)).not.toBeUndefined();
            }
          });
        });
      },
      TIMEOUT
    );
  });
}
