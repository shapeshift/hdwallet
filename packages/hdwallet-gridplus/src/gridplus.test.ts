import * as core from "@shapeshiftoss/hdwallet-core";

import { GridPlusWalletInfo } from "./gridplus";

describe("GridPlusWalletInfo", () => {
  const info = new GridPlusWalletInfo();

  describe("ethGetAccountPaths", () => {
    it("should return correct BIP44 path for account 0", () => {
      const paths = info.ethGetAccountPaths({ coin: "Ethereum", accountIdx: 0 });
      expect(paths).toMatchObject([
        {
          addressNList: core.bip32ToAddressNList("m/44'/60'/0'/0/0"),
          hardenedPath: core.bip32ToAddressNList("m/44'/60'/0'"),
          relPath: [0, 0],
          description: "GridPlus",
        },
      ]);
    });

    it("should return correct BIP44 path for account 1", () => {
      const paths = info.ethGetAccountPaths({ coin: "Ethereum", accountIdx: 1 });
      expect(paths).toMatchObject([
        {
          addressNList: core.bip32ToAddressNList("m/44'/60'/0'/0/1"),
          hardenedPath: core.bip32ToAddressNList("m/44'/60'/0'"),
          relPath: [0, 1],
          description: "GridPlus",
        },
      ]);
    });

    it("should return correct BIP44 path for account 2", () => {
      const paths = info.ethGetAccountPaths({ coin: "Ethereum", accountIdx: 2 });
      expect(paths).toMatchObject([
        {
          addressNList: core.bip32ToAddressNList("m/44'/60'/0'/0/2"),
          hardenedPath: core.bip32ToAddressNList("m/44'/60'/0'"),
          relPath: [0, 2],
          description: "GridPlus",
        },
      ]);
    });

    it("should return empty array for unknown coin", () => {
      const paths = info.ethGetAccountPaths({ coin: "UnknownCoin", accountIdx: 0 });
      expect(paths).toEqual([]);
    });
  });

  describe("ethNextAccountPath", () => {
    it("should increment address index from account 0 to account 1", () => {
      const path0 = info.ethGetAccountPaths({ coin: "Ethereum", accountIdx: 0 })[0];
      const path1 = info.ethNextAccountPath(path0);

      expect(path1).toBeDefined();
      expect(path1!.addressNList).toEqual(core.bip32ToAddressNList("m/44'/60'/0'/0/1"));
      expect(path1!.relPath).toEqual([0, 1]);
    });

    it("should increment address index from account 1 to account 2", () => {
      const path1 = info.ethGetAccountPaths({ coin: "Ethereum", accountIdx: 1 })[0];
      const path2 = info.ethNextAccountPath(path1);

      expect(path2).toBeDefined();
      expect(path2!.addressNList).toEqual(core.bip32ToAddressNList("m/44'/60'/0'/0/2"));
      expect(path2!.relPath).toEqual([0, 2]);
    });

    it("should return undefined for non-BIP44 paths", () => {
      const invalidPath: core.ETHAccountPath = {
        addressNList: [0x80000000 + 49, 0x80000000 + 60, 0x80000000 + 0, 0, 0],
        hardenedPath: [0x80000000 + 49, 0x80000000 + 60, 0x80000000 + 0],
        relPath: [0, 0],
        description: "Invalid",
      };
      const result = info.ethNextAccountPath(invalidPath);
      expect(result).toBeUndefined();
    });
  });
});
