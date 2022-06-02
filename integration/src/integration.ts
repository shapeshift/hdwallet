import * as core from "@shapeshiftoss/hdwallet-core";
import * as keepkey from "@shapeshiftoss/hdwallet-keepkey";
import * as ledger from "@shapeshiftoss/hdwallet-ledger";
import * as metamask from "@shapeshiftoss/hdwallet-metamask";
import * as native from "@shapeshiftoss/hdwallet-native";
import * as portis from "@shapeshiftoss/hdwallet-portis";
import * as tallyHo from "@shapeshiftoss/hdwallet-tallyho";
import * as trezor from "@shapeshiftoss/hdwallet-trezor";
import * as xdefi from "@shapeshiftoss/hdwallet-xdefi";

import { binanceTests } from "./binance";
import { btcTests } from "./bitcoin";
import { cosmosTests } from "./cosmos";
import { eosTests } from "./eos";
import { ethTests } from "./ethereum";
import { fioTests } from "./fio";
import { kavaTests } from "./kava";
import { osmosisTests } from "./osmosis";
import { rippleTests } from "./ripple";
import { secretTests } from "./secret";
import { terraTests } from "./terra";
import { thorchainTests } from "./thorchain";
import { WalletSuite } from "./wallets/suite";

/**
 * We run all the integration tests against every device, even though some
 * devices might not support a given Coin mixin. Tests in the various suites
 * are designed to check for support, and if it's not available, the test is
 * marked as 'passed'. A WalletSuite implementation is therefore expected to
 * assert support for its various attributes (say, support for BTC or ETH), and
 * confirm that in its `selfTest` implementation.
 */

export function integration(suite: WalletSuite): void {
  const name: string = suite.name();

  let wallet: core.HDWallet;
  let info: core.HDWalletInfo;

  describe(`${name}`, () => {
    beforeAll(() => {
      info = suite.createInfo();
    });

    describe("Type Guards", () => {
      beforeAll(async () => {
        wallet = await suite.createWallet();
      });

      it("has only one vendor", () => {
        expect(
          (keepkey.isKeepKey(wallet) ? 1 : 0) +
            (trezor.isTrezor(wallet) ? 1 : 0) +
            (ledger.isLedger(wallet) ? 1 : 0) +
            (portis.isPortis(wallet) ? 1 : 0) +
            (native.isNative(wallet) ? 1 : 0) +
            (metamask.isMetaMask(wallet) ? 1 : 0) +
            (tallyHo.isTallyHo(wallet) ? 1 : 0) +
            (xdefi.isXDEFI(wallet) ? 1 : 0)
        ).toEqual(1);
      });
    });

    describe("ETHWallet", () => {
      beforeAll(async () => {
        wallet = await suite.createWallet("Ethereum");
      });

      ethTests(() => ({ wallet, info }));
    });

    describe("BTCWallet", () => {
      beforeAll(async () => {
        wallet = await suite.createWallet("Bitcoin");
      });

      btcTests(() => ({ wallet, info }));
    });

    describe("EosWallet", () => {
      beforeAll(async () => {
        wallet = await suite.createWallet("Eos");
      });

      eosTests(() => ({ wallet, info }));
    });

    describe("FioWallet", () => {
      let wallet2: core.HDWallet;
      beforeAll(async () => {
        wallet = await suite.createWallet("Fio");
        wallet2 = await suite.createWallet("Fio");
      });

      fioTests(() => ({ wallet, info, wallet2 }));
    });

    describe("CosmosWallet", () => {
      beforeAll(async () => {
        wallet = await suite.createWallet("Cosmos");
      });

      cosmosTests(() => ({ wallet, info }));
    });

    describe("OsmosisWallet", () => {
      beforeAll(async () => {
        wallet = await suite.createWallet("Osmo");
      });
      osmosisTests(() => ({ wallet, info }));
    });

    describe("BinanceWallet", () => {
      beforeAll(async () => {
        wallet = await suite.createWallet("Binance");
      });

      binanceTests(() => ({ wallet, info }));
    });

    describe("RippleWallet", () => {
      beforeAll(async () => {
        wallet = await suite.createWallet("Ripple");
      });

      rippleTests(() => ({ wallet, info }));
    });

    describe("ThorchainWallet", () => {
      beforeAll(async () => {
        wallet = await suite.createWallet("Thorchain");
      });

      thorchainTests(() => ({ wallet, info }));
    });

    describe("SecretWallet", () => {
      beforeAll(async () => {
        wallet = await suite.createWallet("Secret");
      });

      secretTests(() => ({ wallet, info }));
    });

    describe("TerraWallet", () => {
      beforeAll(async () => {
        wallet = await suite.createWallet("Terra");
      });

      terraTests(() => ({ wallet, info }));
    });

    describe("KavaWallet", () => {
      beforeAll(async () => {
        wallet = await suite.createWallet("Kava");
      });

      kavaTests(() => ({ wallet, info }));
    });

    describe("SelfTest", () => {
      beforeAll(async () => {
        wallet = await suite.createWallet();
      });

      suite.selfTest(() => wallet);
    });
  });
}
