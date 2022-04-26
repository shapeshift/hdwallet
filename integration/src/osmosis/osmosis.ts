/* eslint-disable jest/no-disabled-tests */
import * as core from "@shapeshiftoss/hdwallet-core";

import tx_unsigned_delegation from "./tx01.mainnet.osmosis.delegate.json";
import tx_signed_delegation from "./tx01.mainnet.osmosis.delegate.signed.json";
import tx_unsigned_lp_add_osmosis from "./tx01.mainnet.osmosis.lp-add.json";
import tx_signed_lp_add_osmosis from "./tx01.mainnet.osmosis.lp-add.signed.json";
import tx_unsigned_lp_remove_osmosis from "./tx01.mainnet.osmosis.lp-remove.json";
import tx_signed_lp_remove_osmosis from "./tx01.mainnet.osmosis.lp-remove.signed.json";
import tx_unsigned_lp_stake_osmosis from "./tx01.mainnet.osmosis.lp-stake.json";
import tx_signed_lp_stake_osmosis from "./tx01.mainnet.osmosis.lp-stake.signed.json";
import tx_unsigned_lp_unstake_osmosis from "./tx01.mainnet.osmosis.lp-unstake.json";
import tx_signed_lp_unstake_osmosis from "./tx01.mainnet.osmosis.lp-unstake.signed.json";
import tx_unsigned_redelegate_osmosis from "./tx01.mainnet.osmosis.redelegate.json";
import tx_signed_redelegate_osmosis from "./tx01.mainnet.osmosis.redelegate.signed.json";
import tx_unsigned_rewards_osmosis from "./tx01.mainnet.osmosis.rewards.json";
import tx_signed_rewards_osmosis from "./tx01.mainnet.osmosis.rewards.signed.json";
import tx_unsigned_transfer from "./tx01.mainnet.osmosis.transfer.json";
import tx_signed_transfer from "./tx01.mainnet.osmosis.transfer.signed.json";
import tx_unigned_undelegate_osmosis from "./tx01.mainnet.osmosis.undelegate.json";
import tx_signed_undelegate_osmosis from "./tx01.mainnet.osmosis.undelegate.signed.json";

const MNEMONIC12_NOPIN_NOPASSPHRASE = "alcohol woman abuse must during monitor noble actual mixed trade anger aisle";

const TIMEOUT = 60 * 1000;

/**
 *  Main integration suite for testing OsmosisWallet implementations' Osmosis support.
 */
export function osmosisTests(get: () => { wallet: core.HDWallet; info: core.HDWalletInfo }): void {
  let wallet: core.OsmosisWallet & core.HDWallet;

  describe("Osmosis", () => {
    beforeAll(async () => {
      const { wallet: w } = get();
      if (core.supportsOsmosis(w)) {
        wallet = w;
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

    test(
      "osmosisGetAccountPaths()",
      () => {
        if (!wallet) return;
        const paths = wallet.osmosisGetAccountPaths({ accountIdx: 0 });
        expect(paths.length > 0).toBe(true);
        expect(paths[0].addressNList[0] > 0x80000000).toBe(true);
      },
      TIMEOUT
    );

    test(
      "osmosisGetAddress()",
      async () => {
        if (!wallet) return;
        expect(
          await wallet.osmosisGetAddress({
            addressNList: core.bip32ToAddressNList("m/44'/118'/0'/0/0"),
            showDisplay: false,
          })
        ).toEqual("osmo15cenya0tr7nm3tz2wn3h3zwkht2rxrq7g9ypmq");
      },
      TIMEOUT
    );

    test(
      "osmosisSignTx()",
      async () => {
        if (!wallet) return;
        const input: core.OsmosisSignTx = {
          tx: tx_unsigned_transfer as unknown as any,
          addressNList: core.bip32ToAddressNList("m/44'/118'/0'/0/0"),
          chain_id: tx_unsigned_transfer.chain_id,
          account_number: tx_unsigned_transfer.account_number,
          sequence: tx_unsigned_transfer.sequence,
        };

        const res = await wallet.osmosisSignTx(input);
        expect(res).toEqual(tx_signed_transfer);
      },
      TIMEOUT
    );

    //delegate tx
    test(
      "(delegate) osmosisSignTx()",
      async () => {
        if (!wallet) return;
        const input: core.OsmosisSignTx = {
          tx: tx_unsigned_delegation as unknown as any,
          addressNList: core.bip32ToAddressNList("m/44'/118'/0'/0/0"),
          chain_id: tx_unsigned_delegation.chain_id,
          account_number: tx_unsigned_delegation.account_number,
          sequence: tx_unsigned_delegation.sequence,
        };

        const res = await wallet.osmosisSignTx(input);
        expect(res).toEqual(tx_signed_delegation);
      },
      TIMEOUT
    );

    //undelegate
    test.skip(
      "(undelegate) osmosisSignTx()",
      async () => {
        if (!wallet) return;
        const input: core.OsmosisSignTx = {
          tx: tx_unigned_undelegate_osmosis as unknown as any,
          addressNList: core.bip32ToAddressNList("m/44'/118'/0'/0/0"),
          chain_id: tx_unigned_undelegate_osmosis.chain_id,
          account_number: tx_unigned_undelegate_osmosis.account_number,
          sequence: tx_unigned_undelegate_osmosis.sequence,
        };

        const res = await wallet.osmosisSignTx(input);
        expect(res).toEqual(tx_signed_undelegate_osmosis);
      },
      TIMEOUT
    );

    //redelegate
    test(
      "(redelegate) osmosisSignTx()",
      async () => {
        if (!wallet) return;
        const input: core.OsmosisSignTx = {
          tx: tx_unsigned_redelegate_osmosis as unknown as any,
          addressNList: core.bip32ToAddressNList("m/44'/118'/0'/0/0"),
          chain_id: tx_unsigned_redelegate_osmosis.chain_id,
          account_number: tx_unsigned_redelegate_osmosis.account_number,
          sequence: tx_unsigned_redelegate_osmosis.sequence,
        };

        const res = await wallet.osmosisSignTx(input);
        expect(res).toEqual(tx_signed_redelegate_osmosis);
      },
      TIMEOUT
    );

    //claim reward
    test(
      "(claim) osmosisSignTx()",
      async () => {
        if (!wallet) return;
        const input: core.OsmosisSignTx = {
          tx: tx_unsigned_rewards_osmosis as unknown as any,
          addressNList: core.bip32ToAddressNList("m/44'/118'/0'/0/0"),
          chain_id: tx_unsigned_rewards_osmosis.chain_id,
          account_number: tx_unsigned_rewards_osmosis.account_number,
          sequence: tx_unsigned_rewards_osmosis.sequence,
        };

        const res = await wallet.osmosisSignTx(input);
        expect(res).toEqual(tx_signed_rewards_osmosis);
      },
      TIMEOUT
    );

    //lp add
    test.skip(
      "(lp add) osmosisSignTx()",
      async () => {
        if (!wallet) return;
        const input: core.OsmosisSignTx = {
          tx: tx_unsigned_lp_add_osmosis as unknown as any,
          addressNList: core.bip32ToAddressNList("m/44'/118'/0'/0/0"),
          chain_id: tx_unsigned_lp_add_osmosis.chain_id,
          account_number: tx_unsigned_lp_add_osmosis.account_number,
          sequence: tx_unsigned_lp_add_osmosis.sequence,
        };

        const res = await wallet.osmosisSignTx(input);
        expect(res).toEqual(tx_signed_lp_add_osmosis);
      },
      TIMEOUT
    );

    test(
      "(lp remove) osmosisSignTx()",
      async () => {
        if (!wallet) return;
        const input: core.OsmosisSignTx = {
          tx: tx_unsigned_lp_remove_osmosis as unknown as any,
          addressNList: core.bip32ToAddressNList("m/44'/118'/0'/0/0"),
          chain_id: tx_unsigned_lp_remove_osmosis.chain_id,
          account_number: tx_unsigned_lp_remove_osmosis.account_number,
          sequence: tx_unsigned_lp_remove_osmosis.sequence,
        };

        const res = await wallet.osmosisSignTx(input);
        expect(res).toEqual(tx_signed_lp_remove_osmosis);
      },
      TIMEOUT
    );

    //lp stake
    test.skip(
      "(lp stake) osmosisSignTx()",
      async () => {
        if (!wallet) return;
        const input: core.OsmosisSignTx = {
          tx: tx_unsigned_lp_stake_osmosis as unknown as any,
          addressNList: core.bip32ToAddressNList("m/44'/118'/0'/0/0"),
          chain_id: tx_unsigned_lp_stake_osmosis.chain_id,
          account_number: tx_unsigned_lp_stake_osmosis.account_number,
          sequence: tx_unsigned_lp_stake_osmosis.sequence,
        };

        const res = await wallet.osmosisSignTx(input);
        expect(res).toEqual(tx_signed_lp_stake_osmosis);
      },
      TIMEOUT
    );

    //lp unstake
    test.skip(
      "(lp unstake) osmosisSignTx()",
      async () => {
        if (!wallet) return;
        const input: core.OsmosisSignTx = {
          tx: tx_unsigned_lp_unstake_osmosis as unknown as any,
          addressNList: core.bip32ToAddressNList("m/44'/118'/0'/0/0"),
          chain_id: tx_unsigned_lp_unstake_osmosis.chain_id,
          account_number: tx_unsigned_lp_unstake_osmosis.account_number,
          sequence: tx_unsigned_lp_unstake_osmosis.sequence,
        };

        const res = await wallet.osmosisSignTx(input);
        expect(res).toEqual(tx_signed_lp_unstake_osmosis);
      },
      TIMEOUT
    );
  });
}
