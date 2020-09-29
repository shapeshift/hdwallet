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
        expect(toHexString(res.signatureR)).toEqual("729e0a94e5a587d7f10001214fc017e56c8753ff0fc785eb3e91b3f471d58864");
        expect(toHexString(res.signatureS)).toEqual("532ee29e14bc925b37dec2cab72863b5bf82af581f2250b5149722582b56998d");
        expect(toHexString(res.hash)).toEqual("a862b70cf84b68b1824eac84b64c122fdd1bf580f955262fcf083a9f495f7c56");
      },
      TIMEOUT
    );

    test(
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
        expect(toHexString(res.signatureR)).toEqual("1958d41d398443ae558679476f437f119a7bd6de8a34f79bf8b6328d92d61e32");
        expect(toHexString(res.signatureS)).toEqual("2ec1c816d2684411878c2f88e877413bfbbca50bc7d93ace8b9d82b49466bc8f");
        expect(toHexString(res.hash)).toEqual("3aa0ee13030e1e84440e1f51e11e10e009792004e262b156fddef77aa359be94");
      },
      TIMEOUT
    );
  });
}
