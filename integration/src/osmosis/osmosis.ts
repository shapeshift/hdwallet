import * as core from "@shapeshiftoss/hdwallet-core";

import tx_transfer from "./tx01.mainnet.osmosis.transfer.json";
import tx_delegate from "./tx01.mainnet.osmosis.delegate.json";
import tx_undelegate from "./tx01.mainnet.osmosis.undelegate.json";
import tx_redelegate from "./tx01.mainnet.osmosis.redelegate.json";
import tx_rewards from "./tx01.mainnet.osmosis.rewards.json";
import tx_lp_add from "./tx01.mainnet.osmosis.lp-add.json";
import tx_lp_remove from "./tx01.mainnet.osmosis.lp-remove.json";
import tx_token_farm from "./tx01.mainnet.osmosis.lp-token-farm.json";
import tx_swap from "./tx01.mainnet.osmosis.swap.json";
import tx_vote from "./tx01.mainnet.osmosis.vote.json";
//osmo is the broadcast chain, cosmos is the target ibc withdrawal network.
import cosmos_ibc_withdrawal from "./tx01.mainnet.cosmos.ibc.withdrawal.json";

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
      if (core.supportsOsmosis(w)){
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

    //transfer
    test(
      "(transfer) osmosisSignTx()",
      async () => {
        if (!wallet) return;
        const input: core.OsmosisSignTx = {
          tx: (tx_transfer.value as unknown) as any,
          addressNList: core.bip32ToAddressNList("m/44'/118'/0'/0/0"),
          chain_id: "osmosis-1",
          account_number: "95421",
          sequence: "5",
        };

        const res = await wallet.osmosisSignTx(input);
        console.log("transfer res?.signatures?.[0].signature: ", res?.signatures?.[0].signature)
        expect(res?.signatures?.[0].signature).toEqual((tx_transfer.value.signatures as core.Osmosis.StdSignature[])[0].signature);
      },
      TIMEOUT
    );

    //delegate tx
    test(
      "(delegate) osmosisSignTx()",
      async () => {
        if (!wallet) return;
        const input: core.OsmosisSignTx = {
          tx: (tx_delegate.value as unknown) as any,
          addressNList: core.bip32ToAddressNList("m/44'/118'/0'/0/0"),
          chain_id: "osmosis-1",
          account_number: "95421",
          sequence: "5",
        };

        const res = await wallet.osmosisSignTx(input);
        console.log("delegate res?.signatures?.[0].signature: ", res?.signatures?.[0].signature)
        expect(res?.signatures?.[0].signature).toEqual(tx_delegate.value.signatures[0].signature);
      },
      TIMEOUT
    );

    //undelegate
    test(
      "(undelegate) osmosisSignTx()",
      async () => {
        if (!wallet) return;
        const input: core.OsmosisSignTx = {
          tx: (tx_undelegate.value as unknown) as any,
          addressNList: core.bip32ToAddressNList("m/44'/118'/0'/0/0"),
          chain_id: "osmosis-1",
          account_number: "95421",
          sequence: "5",
        };

        const res = await wallet.osmosisSignTx(input);
        console.log("undelegate res?.signatures?.[0].signature: ", res?.signatures?.[0].signature)
        expect(res?.signatures?.[0].signature).toEqual(tx_undelegate.value.signatures[0].signature);
      },
      TIMEOUT
    );

    //redelegate
    test(
      "(redelegate) osmosisSignTx()",
      async () => {
        if (!wallet) return;
        const input: core.OsmosisSignTx = {
          tx: (tx_redelegate.value as unknown) as any,
          addressNList: core.bip32ToAddressNList("m/44'/118'/0'/0/0"),
          chain_id: "osmosis-1",
          account_number: "95421",
          sequence: "5",
        };

        const res = await wallet.osmosisSignTx(input);
        console.log("redelegate res?.signatures?.[0].signature: ", res?.signatures?.[0].signature)
        expect(res?.signatures?.[0].signature).toEqual(tx_redelegate.value.signatures[0].signature);
      },
      TIMEOUT
    );

    //claim reward TODO
    test(
      "(claim rewards) osmosisSignTx()",
      async () => {
        if (!wallet) return;
        const input: core.OsmosisSignTx = {
          tx: (tx_rewards.value as unknown) as any,
          addressNList: core.bip32ToAddressNList("m/44'/118'/0'/0/0"),
          chain_id: "osmosis-1",
          account_number: "95421",
          sequence: "5",
        };

        const res = await wallet.osmosisSignTx(input);
        console.log("claim rewards res?.signatures?.[0].signature: ", res?.signatures?.[0].signature)
        expect(res?.signatures?.[0].signature).toEqual(tx_rewards.value.signatures[0].signature);
      },
      TIMEOUT
    );

    //lp add
    test(
      "(LP add) osmosisSignTx()",
      async () => {
        if (!wallet) return;
        const input: core.OsmosisSignTx = {
          tx: (tx_lp_add.value as unknown) as any,
          addressNList: core.bip32ToAddressNList("m/44'/118'/0'/0/0"),
          chain_id: "osmosis-1",
          account_number: "95421",
          sequence: "5",
        };

        const res = await wallet.osmosisSignTx(input);
        console.log("LP add rewards res?.signatures?.[0].signature: ", res?.signatures?.[0].signature)
        expect(res?.signatures?.[0].signature).toEqual(tx_lp_add.value.signatures[0].signature);
      },
      TIMEOUT
    );

    //lp remove
    test(
      "(LP remove) osmosisSignTx()",
      async () => {
        if (!wallet) return;
        const input: core.OsmosisSignTx = {
          tx: (tx_lp_remove.value as unknown) as any,
          addressNList: core.bip32ToAddressNList("m/44'/118'/0'/0/0"),
          chain_id: "osmosis-1",
          account_number: "95421",
          sequence: "5",
        };

        const res = await wallet.osmosisSignTx(input);
        console.log("LP remove res?.signatures?.[0].signature: ", res?.signatures?.[0].signature)
        expect(res?.signatures?.[0].signature).toEqual(tx_lp_remove.value.signatures[0].signature);
      },
      TIMEOUT
    );


    //lp stake
    test(
      "(stake LP token) osmosisSignTx()",
      async () => {
        if (!wallet) return;
        const input: core.OsmosisSignTx = {
          tx: (tx_token_farm.value as unknown) as any,
          addressNList: core.bip32ToAddressNList("m/44'/118'/0'/0/0"),
          chain_id: "osmosis-1",
          account_number: "95421",
          sequence: "5",
        };

        const res = await wallet.osmosisSignTx(input);
        console.log("stake LP res?.signatures?.[0].signature: ", res?.signatures?.[0].signature)
        expect(res?.signatures?.[0].signature).toEqual(tx_token_farm.value.signatures[0].signature);
      },
      TIMEOUT
    );

    //swap
    test(
      "(tx_swap) osmosisSignTx()",
      async () => {
        if (!wallet) return;
        const input: core.OsmosisSignTx = {
          tx: (tx_swap.value as unknown) as any,
          addressNList: core.bip32ToAddressNList("m/44'/118'/0'/0/0"),
          chain_id: "osmosis-1",
          account_number: "95421",
          sequence: "5",
        };

        const res = await wallet.osmosisSignTx(input);
        console.log("tx_swap res?.signatures?.[0].signature: ", res?.signatures?.[0].signature)
        expect(res?.signatures?.[0].signature).toEqual(tx_swap.value.signatures[0].signature);
      },
      TIMEOUT
    );

    //cosmos ibc withdrawal
    test(
      "(cosmos_ibc_withdrawal) osmosisSignTx()",
      async () => {
        if (!wallet) return;
        const input: core.OsmosisSignTx = {
          tx: (tx_swap.value as unknown) as any,
          addressNList: core.bip32ToAddressNList("m/44'/118'/0'/0/0"),
          chain_id: "osmosis-1",
          account_number: "95421",
          sequence: "5",
        };

        const res = await wallet.osmosisSignTx(input);
        console.log("cosmos_ibc_withdrawal res?.signatures?.[0].signature: ", res?.signatures?.[0].signature)
        expect(res?.signatures?.[0].signature).toEqual(tx_swap.value.signatures[0].signature);
      },
      TIMEOUT
    );

    //vote
    test(
      "(tx_vote) osmosisSignTx()",
      async () => {
        if (!wallet) return;
        const input: core.OsmosisSignTx = {
          tx: (tx_vote.value as unknown) as any,
          addressNList: core.bip32ToAddressNList("m/44'/118'/0'/0/0"),
          chain_id: "osmosis-1",
          account_number: "95421",
          sequence: "5",
        };

        const res = await wallet.osmosisSignTx(input);
        console.log("tx_vote res?.signatures?.[0].signature: ", res?.signatures?.[0].signature)
        expect(res?.signatures?.[0].signature).toEqual(tx_vote.value.signatures[0].signature);
      },
      TIMEOUT
    );

  });
}
