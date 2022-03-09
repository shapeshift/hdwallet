import * as core from "@shapeshiftoss/hdwallet-core";

//delgation
import tx_unsigned_delegation from "./tx01.mainnet.cosmos.delegate.json";
import tx_signed_delegation from "./tx01.mainnet.cosmos.delegate.signed.json";
//IBC
import tx_unsigned_ibc_cosmos from "./tx01.mainnet.cosmos.ibc.transfer.json";
import tx_signed_ibc_cosmos from "./tx01.mainnet.cosmos.ibc.transfer.signed.json";
import tx_unsigned_transfer from "./tx01.mainnet.cosmos.json";
import tx_unsigned_rewards_cosmos from "./tx01.mainnet.cosmos.rewards.json";
import tx_signed_rewards_cosmos from "./tx01.mainnet.cosmos.rewards.signed.json";
import tx_signed_trasnfer from "./tx01.mainnet.cosmos.signed.json";
import tx_unigned_undelegate_cosmos from "./tx01.mainnet.cosmos.undelegate.json";
import tx_unsigned_redelegate_cosmos from "./tx01.mainnet.cosmos.undelegate.json";
import tx_signed_undelegate_cosmos from "./tx01.mainnet.cosmos.undelegate.signed.json";
import tx_signed_redelegate_cosmos from "./tx01.mainnet.cosmos.undelegate.signed.json";

const MNEMONIC12_NOPIN_NOPASSPHRASE = "alcohol woman abuse must during monitor noble actual mixed trade anger aisle";

const TIMEOUT = 60 * 1000;

/**
 *  Main integration suite for testing CosmosWallet implementations' Cosmos support.
 */
export function cosmosTests(get: () => { wallet: core.HDWallet; info: core.HDWalletInfo }): void {
  let wallet: core.CosmosWallet & core.HDWallet;

  describe("Cosmos", () => {
    beforeAll(async () => {
      const { wallet: w } = get();
      if (core.supportsCosmos(w)) wallet = w;
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
      "cosmosGetAccountPaths()",
      () => {
        if (!wallet) return;
        const paths = wallet.cosmosGetAccountPaths({ accountIdx: 0 });
        expect(paths.length > 0).toBe(true);
        expect(paths[0].addressNList[0] > 0x80000000).toBe(true);
      },
      TIMEOUT
    );

    test(
      "cosmosGetAddress()",
      async () => {
        if (!wallet) return;
        expect(
          await wallet.cosmosGetAddress({
            addressNList: core.bip32ToAddressNList("m/44'/118'/0'/0/0"),
            showDisplay: false,
          })
        ).toEqual("cosmos15cenya0tr7nm3tz2wn3h3zwkht2rxrq7q7h3dj");
      },
      TIMEOUT
    );

    //transfer
    test(
      "cosmosSignTx()",
      async () => {
        if (!wallet) return;
        const input: core.CosmosSignTx = {
          tx: tx_unsigned_transfer as unknown as core.CosmosTx,
          addressNList: core.bip32ToAddressNList("m/44'/118'/0'/0/0"),
          chain_id: tx_unsigned_transfer.chain_id,
          account_number: tx_unsigned_transfer.account_number,
          sequence: tx_unsigned_transfer.sequence,
        };

        const res = await wallet.cosmosSignTx(input);
        expect(res?.signatures?.[0]).toEqual(tx_signed_trasnfer.signatures[0]);
      },
      TIMEOUT
    );

    //delegate tx
    test(
      "(delegate) cosmosSignTx()",
      async () => {
        if (!wallet) return;
        const input: core.CosmosSignTx = {
          tx: tx_unsigned_delegation as unknown as any,
          addressNList: core.bip32ToAddressNList("m/44'/118'/0'/0/0"),
          chain_id: tx_unsigned_delegation.chain_id,
          account_number: tx_unsigned_delegation.account_number,
          sequence: tx_unsigned_delegation.sequence,
        };

        const res = await wallet.cosmosSignTx(input);
        expect(res?.signatures?.[0]).toEqual(tx_signed_delegation.signatures[0]);
      },
      TIMEOUT
    );

    //undelegate
    test(
      "(undelegate) cosmosSignTx()",
      async () => {
        if (!wallet) return;
        const input: core.CosmosSignTx = {
          tx: tx_unigned_undelegate_cosmos as unknown as any,
          addressNList: core.bip32ToAddressNList("m/44'/118'/0'/0/0"),
          chain_id: tx_unigned_undelegate_cosmos.chain_id,
          account_number: tx_unigned_undelegate_cosmos.account_number,
          sequence: tx_unigned_undelegate_cosmos.sequence,
        };

        const res = await wallet.cosmosSignTx(input);
        expect(res?.signatures?.[0]).toEqual(tx_signed_undelegate_cosmos.signatures[0]);
      },
      TIMEOUT
    );

    //redelegate
    test(
      "(redelegate) cosmosSignTx()",
      async () => {
        if (!wallet) return;
        const input: core.CosmosSignTx = {
          tx: tx_unsigned_redelegate_cosmos as unknown as any,
          addressNList: core.bip32ToAddressNList("m/44'/118'/0'/0/0"),
          chain_id: tx_unsigned_redelegate_cosmos.chain_id,
          account_number: tx_unsigned_redelegate_cosmos.account_number,
          sequence: tx_unsigned_redelegate_cosmos.sequence,
        };

        const res = await wallet.cosmosSignTx(input);
        expect(res?.signatures?.[0]).toEqual(tx_signed_redelegate_cosmos.signatures[0]);
      },
      TIMEOUT
    );

    //claim reward
    test(
      "(claim) cosmosSignTx()",
      async () => {
        if (!wallet) return;
        const input: core.CosmosSignTx = {
          tx: tx_unsigned_rewards_cosmos as unknown as any,
          addressNList: core.bip32ToAddressNList("m/44'/118'/0'/0/0"),
          chain_id: tx_unsigned_rewards_cosmos.chain_id,
          account_number: tx_unsigned_rewards_cosmos.account_number,
          sequence: tx_unsigned_rewards_cosmos.sequence,
        };

        const res = await wallet.cosmosSignTx(input);
        expect(res?.signatures?.[0]).toEqual(tx_signed_rewards_cosmos.signatures[0]);
      },
      TIMEOUT
    );

    //IBC
    test(
      "(ibc transfer) cosmosSignTx()",
      async () => {
        if (!wallet) return;
        const input: core.CosmosSignTx = {
          tx: tx_unsigned_ibc_cosmos as unknown as any,
          addressNList: core.bip32ToAddressNList("m/44'/118'/0'/0/0"),
          chain_id: tx_unsigned_ibc_cosmos.chain_id,
          account_number: tx_unsigned_ibc_cosmos.account_number,
          sequence: tx_unsigned_ibc_cosmos.sequence,
        };

        const res = await wallet.cosmosSignTx(input);
        expect(res?.signatures?.[0]).toEqual(tx_signed_ibc_cosmos.signatures[0]);
      },
      TIMEOUT
    );
  });
}
