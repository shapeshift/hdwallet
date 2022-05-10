import * as core from "@shapeshiftoss/hdwallet-core";
import * as keepkey from "@shapeshiftoss/hdwallet-keepkey";

// Amino-encoded transactions
import tx_unsigned_delegate_cosmos_amino from "./amino/tx01.mainnet.cosmos.delegate.json";
import tx_signed_delegate_cosmos_amino from "./amino/tx01.mainnet.cosmos.delegate.signed.json";
import tx_unsigned_ibc_cosmos_amino from "./amino/tx01.mainnet.cosmos.ibc.transfer.json";
import tx_signed_ibc_cosmos_amino from "./amino/tx01.mainnet.cosmos.ibc.transfer.signed.json";
import tx_unsigned_redelegate_cosmos_amino from "./amino/tx01.mainnet.cosmos.redelegate.json";
import tx_signed_redelegate_cosmos_amino from "./amino/tx01.mainnet.cosmos.redelegate.signed.json";
import tx_unsigned_rewards_cosmos_amino from "./amino/tx01.mainnet.cosmos.rewards.json";
import tx_signed_rewards_cosmos_amino from "./amino/tx01.mainnet.cosmos.rewards.signed.json";
import tx_unsigned_transfer_cosmos_amino from "./amino/tx01.mainnet.cosmos.transfer.json";
import tx_signed_transfer_cosmos_amino from "./amino/tx01.mainnet.cosmos.transfer.signed.json";
import tx_unsigned_undelegate_cosmos_amino from "./amino/tx01.mainnet.cosmos.undelegate.json";
import tx_signed_undelegate_cosmos_amino from "./amino/tx01.mainnet.cosmos.undelegate.signed.json";
// Protobuf-encoded transactions
import tx_unsigned_delegate_cosmos from "./tx01.mainnet.cosmos.delegate.json";
import tx_signed_delegate_cosmos from "./tx01.mainnet.cosmos.delegate.signed.json";
import tx_unsigned_ibc_cosmos from "./tx01.mainnet.cosmos.ibc.transfer.json";
import tx_signed_ibc_cosmos from "./tx01.mainnet.cosmos.ibc.transfer.signed.json";
import tx_unsigned_redelegate_cosmos from "./tx01.mainnet.cosmos.redelegate.json";
import tx_signed_redelegate_cosmos from "./tx01.mainnet.cosmos.redelegate.signed.json";
import tx_unsigned_rewards_cosmos from "./tx01.mainnet.cosmos.rewards.json";
import tx_signed_rewards_cosmos from "./tx01.mainnet.cosmos.rewards.signed.json";
import tx_unsigned_transfer_cosmos from "./tx01.mainnet.cosmos.transfer.json";
import tx_signed_transfer_cosmos from "./tx01.mainnet.cosmos.transfer.signed.json";
// import tx_unsigned_undelegate_cosmos from "./tx01.mainnet.cosmos.undelegate.json";
// import tx_signed_undelegate_cosmos from "./tx01.mainnet.cosmos.undelegate.signed.json";

const MNEMONIC12_NOPIN_NOPASSPHRASE = "alcohol woman abuse must during monitor noble actual mixed trade anger aisle";

const TIMEOUT = 60 * 1000;

/**
 *  Main integration suite for testing CosmosWallet implementations' Cosmos support.
 */
export function cosmosTests(get: () => { wallet: core.HDWallet; info: core.HDWalletInfo }): void {
  let wallet: core.CosmosWallet & core.HDWallet;
  let useAmino: boolean;

  describe("Cosmos", () => {
    beforeAll(async () => {
      const { wallet: w } = get();
      if (core.supportsCosmos(w)) wallet = w;
      useAmino = w instanceof keepkey.KeepKeyHDWallet;
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

    describe("comosSignTx()", () => {
      it.each([
        [
          "should correctly sign a transfer tx",
          tx_unsigned_transfer_cosmos_amino,
          tx_unsigned_transfer_cosmos,
          tx_signed_transfer_cosmos_amino,
          tx_signed_transfer_cosmos,
        ],
        [
          "should correctly sign a delegate tx",
          tx_unsigned_delegate_cosmos_amino,
          tx_unsigned_delegate_cosmos,
          tx_signed_delegate_cosmos_amino,
          tx_signed_delegate_cosmos,
        ],
        [
          "should correctly sign a undelegate tx",
          tx_unsigned_undelegate_cosmos_amino,
          // tx_unsigned_undelegate_cosmos,
          undefined,
          tx_signed_undelegate_cosmos_amino,
          // tx_signed_undelegate_cosmos,
          undefined,
        ],
        [
          "should correctly sign a redelegate tx",
          tx_unsigned_redelegate_cosmos_amino,
          tx_unsigned_redelegate_cosmos,
          tx_signed_redelegate_cosmos_amino,
          tx_signed_redelegate_cosmos,
        ],
        [
          "should correctly sign a claim reward tx",
          tx_unsigned_rewards_cosmos_amino,
          tx_unsigned_rewards_cosmos,
          tx_signed_rewards_cosmos_amino,
          tx_signed_rewards_cosmos,
        ],
        [
          "should correctly sign an ibc transfer tx",
          tx_unsigned_ibc_cosmos_amino,
          tx_unsigned_ibc_cosmos,
          tx_signed_ibc_cosmos_amino,
          tx_signed_ibc_cosmos,
        ],
      ])(
        "%s",
        async (_, aminoTx, protoTx, signedAminoTx, signedProtoTx) => {
          const tx = useAmino ? aminoTx : protoTx;
          const signedTx = useAmino ? signedAminoTx : signedProtoTx;
          if (!wallet || !tx) return;

          const input: core.CosmosSignTx = {
            tx,
            addressNList: core.bip32ToAddressNList("m/44'/118'/0'/0/0"),
            chain_id: tx.chain_id,
            account_number: tx.account_number,
            sequence: tx.sequence,
          };

          const res = await wallet.cosmosSignTx(input);
          expect(res).toEqual(signedTx);
        },
        TIMEOUT
      );
    });
  });
}
