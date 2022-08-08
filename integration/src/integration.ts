import * as core from "@shapeshiftoss/hdwallet-core";
import * as keepkey from "@shapeshiftoss/hdwallet-keepkey";
import * as ledger from "@shapeshiftoss/hdwallet-ledger";
import * as metamask from "@shapeshiftoss/hdwallet-metamask";
import * as native from "@shapeshiftoss/hdwallet-native";
import * as portis from "@shapeshiftoss/hdwallet-portis";
import * as tallyHo from "@shapeshiftoss/hdwallet-tallyho";
import * as trezor from "@shapeshiftoss/hdwallet-trezor";
import * as walletconnect from "@shapeshiftoss/hdwallet-walletconnect";
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

  let info: core.HDWalletInfo;

  describe(`${name}`, () => {
    beforeAll(() => {
      info = suite.createInfo();
    });

    describe("Type Guards", () => {
      let wallet: core.HDWallet;
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
            (walletconnect.isWalletConnect(wallet) ? 1 : 0) +
            (xdefi.isXDEFI(wallet) ? 1 : 0)
        ).toEqual(1);
      });
    });

    describe("ETHWallet", () => {
      let ethWallet: core.HDWallet & core.ETHWallet;
      beforeAll(async () => {
        ethWallet = (await suite.createWallet("Ethereum")) as core.HDWallet & core.ETHWallet;
      });

      ethTests(() => ({ wallet: ethWallet, info }));
    });

    describe("BTCWallet", () => {
      let btcWallet: core.HDWallet & core.BTCWallet;
      beforeAll(async () => {
        btcWallet = (await suite.createWallet("Bitcoin")) as core.HDWallet & core.BTCWallet;
      });

      btcTests(() => ({ wallet: btcWallet, info }));
    });

    describe("EosWallet", () => {
      let eosWallet: core.HDWallet & core.EosWallet;
      beforeAll(async () => {
        eosWallet = (await suite.createWallet("Eos")) as core.HDWallet & core.EosWallet;
      });

      eosTests(() => ({ wallet: eosWallet, info }));
    });

    describe("FioWallet", () => {
      let fioWallet: core.HDWallet & core.FioWallet;
      let fioWallet2: core.HDWallet & core.FioWallet;
      beforeAll(async () => {
        fioWallet = (await suite.createWallet("Fio")) as core.HDWallet & core.FioWallet;
        fioWallet2 = (await suite.createWallet("Fio")) as core.HDWallet & core.FioWallet;
      });

      fioTests(() => ({ wallet: fioWallet, info, wallet2: fioWallet2 }));
    });

    describe("CosmosWallet", () => {
      let cosmosWallet: core.HDWallet & core.CosmosWallet;
      beforeAll(async () => {
        cosmosWallet = (await suite.createWallet("Cosmos")) as core.HDWallet & core.CosmosWallet;
      });

      cosmosTests(() => ({ wallet: cosmosWallet, info }));
    });

    describe("OsmosisWallet", () => {
      let osmosisWallet: core.HDWallet & core.OsmosisWallet;
      beforeAll(async () => {
        osmosisWallet = (await suite.createWallet("Osmo")) as core.HDWallet & core.OsmosisWallet;
      });
      osmosisTests(() => ({ wallet: osmosisWallet, info }));
    });

    describe("BinanceWallet", () => {
      let binanceWallet: core.HDWallet & core.BinanceWallet;
      beforeAll(async () => {
        binanceWallet = (await suite.createWallet("Binance")) as core.HDWallet & core.BinanceWallet;
      });

      binanceTests(() => ({ wallet: binanceWallet, info }));
    });

    describe("RippleWallet", () => {
      let rippleWallet: core.HDWallet & core.RippleWallet;
      beforeAll(async () => {
        rippleWallet = (await suite.createWallet("Ripple")) as core.HDWallet & core.RippleWallet;
      });

      rippleTests(() => ({ wallet: rippleWallet, info }));
    });

    describe("ThorchainWallet", () => {
      let thorchainWallet: core.HDWallet & core.ThorchainWallet;
      beforeAll(async () => {
        thorchainWallet = (await suite.createWallet("Thorchain")) as core.HDWallet & core.ThorchainWallet;
      });

      thorchainTests(() => ({ wallet: thorchainWallet, info }));
    });

    describe("SecretWallet", () => {
      let secretWallet: core.HDWallet & core.SecretWallet;
      beforeAll(async () => {
        secretWallet = (await suite.createWallet("Secret")) as core.HDWallet & core.SecretWallet;
      });

      secretTests(() => ({ wallet: secretWallet, info }));
    });

    describe("TerraWallet", () => {
      let terraWallet: core.HDWallet & core.TerraWallet;
      beforeAll(async () => {
        terraWallet = (await suite.createWallet("Terra")) as core.HDWallet & core.TerraWallet;
      });

      terraTests(() => ({ wallet: terraWallet, info }));
    });

    describe("KavaWallet", () => {
      let kavaWallet: core.HDWallet & core.KavaWallet;
      beforeAll(async () => {
        kavaWallet = (await suite.createWallet("Kava")) as core.HDWallet & core.KavaWallet;
      });

      kavaTests(() => ({ wallet: kavaWallet, info }));
    });

    describe("SelfTest", () => {
      let wallet: core.HDWallet;
      beforeAll(async () => {
        wallet = await suite.createWallet();
      });

      suite.selfTest(() => wallet);
    });
  });
}
