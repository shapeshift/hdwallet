import { EosPublicKeyKind } from "@keepkey/device-protocol/lib/messages-eos_pb";

import { bip32ToAddressNList, HDWallet, EosWallet, supportsEos, EosTx } from "@shapeshiftoss/hdwallet-core";

import { HDWalletInfo } from "@shapeshiftoss/hdwallet-core/src/wallet";

import { toHexString } from "@shapeshiftoss/hdwallet-core";

import * as tx01_unsigned from "./tx01.unsigned.json";
import * as tx02_unsigned from "./tx02.unsigned.json";

const MNEMONIC12_NOPIN_NOPASSPHRASE = "alcohol woman abuse must during monitor noble actual mixed trade anger aisle";

const TIMEOUT = 60 * 1000;

/**
 *  Main integration suite for testing eos wallet.
 */
export function eosTests(get: () => { wallet: HDWallet; info: HDWalletInfo }): void {
  let wallet: EosWallet & HDWallet;

  describe("Eos", () => {
    beforeAll(async () => {
      const { wallet: w } = get();
      if (supportsEos(w)) wallet = w;
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
      "eosGetAccountPaths()",
      () => {
        if (!wallet) return;
        let paths = wallet.eosGetAccountPaths({ accountIdx: 0 });
        expect(paths.length > 0).toBe(true);
        expect(paths[0].addressNList[0] > 0x80000000).toBe(true);
        paths.forEach((path) => {
          let curAddr = path.addressNList.join();
          let nextAddr = wallet.eosNextAccountPath(path).addressNList.join();
          expect(nextAddr === undefined || nextAddr !== curAddr).toBeTruthy();
        });
      },
      TIMEOUT
    );

    test(
      "eosGetPublicKey()",
      async () => {
        if (!wallet) return;
        expect(
          await wallet.eosGetPublicKey({
            addressNList: bip32ToAddressNList("m/44'/194'/0'/0/0"),
            showDisplay: false,
            kind: EosPublicKeyKind.EOS,
          })
        ).toEqual("EOS4u6Sfnzj4Sh2pEQnkXyZQJqH3PkKjGByDCbsqqmyq6PttM9KyB");
      },
      TIMEOUT
    );

    test(
      "kk integration eosSignTx()",
      async () => {
        if (!wallet) return;
        let txData = tx01_unsigned as any;
        let res = await wallet.eosSignTx({
          addressNList: bip32ToAddressNList("m/44'/194'/0'/0/0"),
          chain_id: txData.chain_id as string,
          tx: txData.transaction as EosTx,
        });
        expect(res.signatureV).toEqual(31);
        expect(toHexString(res.signatureR)).toEqual("3a58d0889c6e4dde052b76ca092f59f314e2ab4e867164083e108e7a3f40d737");
        expect(toHexString(res.signatureS)).toEqual("448f8175217c2fd9bf9dac753adf1baabdfa3132eab7235158fbdf3cbe346805");
        expect(toHexString(res.hash)).toEqual("86a946cd06ddac53c256700ef8bfeed4d1f72512909400df597c8d594d1b0591");
      },
      TIMEOUT
    );

    test.skip(
      "confirmed on chain eosSignTx()",
      async () => {
        if (!wallet) return;
        let txData = tx02_unsigned as any;
        let res = await wallet.eosSignTx({
          addressNList: bip32ToAddressNList("m/44'/194'/0'/0/0"),
          chain_id: txData.chain_id as string,
          tx: txData.transaction as EosTx,
        });
        expect(res.signatureV).toEqual(31);
        expect(toHexString(res.signatureR)).toEqual("14ce00681a621d1f80a98d5f47a7d703ed515fb9169f0c1f1b54c5199fad7080");
        expect(toHexString(res.signatureS)).toEqual("767e9b510b789763fa62aaa8285f48f57ef3d56bb62ce6ebf650ec8a88aca8f0");
        expect(toHexString(res.hash)).toEqual("d34082c1b4c6f578ef46500e30dcdc4987715d088323da8f2fb2b296f9db7b12");
      },
      TIMEOUT
    );
  });
}
