import * as core from "@shapeshiftoss/hdwallet-core";

import { VultisigHDWallet } from ".";
import { VultisigSolanaProvider, VultisigUtxoProvider } from "./types";

describe("VultisigHDWallet", () => {
  let wallet: VultisigHDWallet;

  beforeEach(() => {
    wallet = new VultisigHDWallet(core.untouchable("VultisigHDWallet:provider"));
  });

  it("should match the metadata", async () => {
    expect(wallet.getVendor()).toBe("Vultisig");
    expect(wallet.hasOnDevicePinEntry()).toBe(false);
    expect(wallet.hasOnDevicePassphrase()).toBe(false);
    expect(wallet.hasOnDeviceDisplay()).toBe(true);
    expect(wallet.hasOnDeviceRecovery()).toBe(true);
    expect(await wallet.ethSupportsNetwork(1)).toBe(true);
    expect(await wallet.ethSupportsSecureTransfer()).toBe(false);
    expect(wallet.ethSupportsNativeShapeShift()).toBe(false);
    expect(await wallet.ethSupportsEIP1559()).toBe(true);
    expect(wallet.supportsOfflineSigning()).toBe(false);
    expect(wallet.supportsBip44Accounts()).toBe(false);
    expect(wallet.supportsBroadcast()).toBe(true);
  });

  describe("Ethereum", () => {
    it("ethGetAddress returns a valid address", async () => {
      wallet.evmProvider = {
        request: jest.fn().mockReturnValue(["0x73d0385F4d8E00C5e6504C6030F47BF6212736A8"]),
      };

      const address = await wallet.ethGetAddress({ addressNList: core.bip32ToAddressNList("m/44'/60'/0'/0/0") });

      expect(address).toEqual("0x73d0385F4d8E00C5e6504C6030F47BF6212736A8");
    });

    it("ethSendTx returns a valid hash", async () => {
      wallet.evmProvider = {
        request: jest.fn().mockReturnValue("0x123"),
      };

      const hash = await wallet.ethSendTx({
        addressNList: core.bip32ToAddressNList("m/44'/60'/0'/0/0"),
        nonce: "0xDEADBEEF",
        gasPrice: "0xDEADBEEF",
        gasLimit: "0xDEADBEEF",
        to: "0xDEADBEEFDEADBEEFDEADBEEFDEADBEEFDEADBEEF",
        value: "0xDEADBEEFDEADBEEFDEADBEEFDEADBEEF",
        data: "0xDEADBEEFDEADBEEFDEADBEEFDEADBEEF",
        chainId: 1,
      });
      expect(wallet.evmProvider.request).toHaveBeenCalled();
      expect(hash).toMatchObject({ hash: "0x123" });
    });

    it("ethSendTx returns a valid hash if maxFeePerGas is present in msg", async () => {
      wallet.evmProvider = {
        request: jest.fn().mockReturnValue("0x123"),
      };

      const hash = await wallet.ethSendTx({
        addressNList: core.bip32ToAddressNList("m/44'/60'/0'/0/0"),
        nonce: "0xDEADBEEF",
        gasLimit: "0xDEADBEEF",
        maxFeePerGas: "0xDEADBEEF",
        to: "0xDEADBEEFDEADBEEFDEADBEEFDEADBEEFDEADBEEF",
        value: "0xDEADBEEFDEADBEEFDEADBEEFDEADBEEF",
        data: "0xDEADBEEFDEADBEEFDEADBEEFDEADBEEF",
        chainId: 1,
      });
      expect(wallet.evmProvider.request).toHaveBeenCalled();
      expect(hash).toMatchObject({ hash: "0x123" });
    });

    it("ethSendTx returns null on error", async () => {
      wallet.evmProvider = {
        request: jest.fn().mockRejectedValue(new Error("An Error has occurred")),
      };

      const hash = await wallet.ethSendTx({
        addressNList: core.bip32ToAddressNList("m/44'/60'/0'/0/0"),
        nonce: "0xDEADBEEF",
        gasPrice: "0xDEADBEEF",
        gasLimit: "0xDEADBEEF",
        to: "0xDEADBEEFDEADBEEFDEADBEEFDEADBEEFDEADBEEF",
        value: "0xDEADBEEFDEADBEEFDEADBEEFDEADBEEF",
        data: "0xDEADBEEFDEADBEEFDEADBEEFDEADBEEF",
        chainId: 1,
      });
      expect(wallet.evmProvider.request).toHaveBeenCalled();
      expect(hash).toBe(null);
    });

    it("should test ethSignMessage", async () => {
      wallet.evmProvider = {
        request: jest.fn().mockReturnValue(
          `Object {
          "address": "0x73d0385F4d8E00C5e6504C6030F47BF6212736A8",
          "signature": "0x05f51140905ffa33ffdc57f46b0b8d8fbb1d2a99f8cd843ca27893c01c31351c08b76d83dce412731c846e3b50649724415deb522d00950fbf4f2c1459c2b70b1b",
        }`
        ),
      };
      const msg = "0x737570657220736563726574206d657373616765"; // super secret message
      expect(
        await wallet.ethSignMessage({
          addressNList: core.bip32ToAddressNList("m/44'/60'/0'/0/0"),
          message: msg,
        })
      ).toMatchInlineSnapshot(`
      Object {
        "address": "O",
        "signature": "Object {
                \\"address\\": \\"0x73d0385F4d8E00C5e6504C6030F47BF6212736A8\\",
                \\"signature\\": \\"0x05f51140905ffa33ffdc57f46b0b8d8fbb1d2a99f8cd843ca27893c01c31351c08b76d83dce412731c846e3b50649724415deb522d00950fbf4f2c1459c2b70b1b\\",
              }",
      }
    `);
    });

    it("ethSignMessage returns null on error", async () => {
      wallet.evmProvider = {
        request: jest.fn().mockRejectedValue(new Error("An Error has occurred")),
      };

      const msg = "0x737570657220736563726574206d657373616765"; // super secret message
      const sig = await wallet.ethSignMessage({
        addressNList: core.bip32ToAddressNList("m/44'/60'/0'/0/0"),
        message: msg,
      });

      expect(sig).toBe(null);
    });

    it("ethVerifyMessage returns true for a valid signature", async () => {
      expect(
        await wallet.ethVerifyMessage({
          address: "0x2068dD92B6690255553141Dfcf00dF308281f763",
          message: "Hello World",
          signature:
            "0x61f1dda82e9c3800e960894396c9ce8164fd1526fccb136c71b88442405f7d09721725629915d10bc7cecfca2818fe76bc5816ed96a1b0cebee9b03b052980131b",
        })
      ).toEqual(true);
    });
  });

  describe("Bitcoin", () => {
    it("btcGetAddress returns a valid address", async () => {
      wallet.bitcoinProvider = {
        request: jest.fn().mockReturnValue(["bc1q9sjm947kn2hz84syykmem7dshvevm8xm5dkrpg"]),
      } as unknown as VultisigUtxoProvider;

      const address = await wallet.btcGetAddress({
        coin: "Bitcoin",
      } as core.BTCGetAddress);

      expect(address).toEqual("bc1q9sjm947kn2hz84syykmem7dshvevm8xm5dkrpg");
    });

    // TODO: hippo: Add tests for getAddress over non-supported script types

    describe("btcGetAccountPaths", () => {
      it("should return correct paths for Bitcoin (BIP84)", () => {
        const paths = wallet.btcGetAccountPaths({
          coin: "Bitcoin",
          accountIdx: 0,
        });

        expect(paths).toHaveLength(1);
        expect(paths[0]).toEqual({
          coin: "Bitcoin",
          scriptType: core.BTCInputScriptType.SpendWitness,
          addressNList: [0x80000000 + 84, 0x80000000 + 0, 0x80000000 + 0, 0, 0],
        });
      });

      it("should return correct paths for Litecoin (BIP84)", () => {
        const paths = wallet.btcGetAccountPaths({
          coin: "Litecoin",
          accountIdx: 0,
        });

        expect(paths).toHaveLength(1);
        expect(paths[0]).toEqual({
          coin: "Litecoin",
          scriptType: core.BTCInputScriptType.SpendWitness,
          addressNList: [0x80000000 + 84, 0x80000000 + 2, 0x80000000 + 0, 0, 0],
        });
      });

      it("should return correct paths for Dash (BIP44)", () => {
        const paths = wallet.btcGetAccountPaths({
          coin: "Dash",
          accountIdx: 0,
        });

        expect(paths).toHaveLength(1);
        expect(paths[0]).toEqual({
          coin: "Dash",
          scriptType: core.BTCInputScriptType.SpendAddress,
          addressNList: [0x80000000 + 44, 0x80000000 + 5, 0x80000000 + 0, 0, 0],
        });
      });

      it("should return correct paths for Dogecoin (BIP44)", () => {
        const paths = wallet.btcGetAccountPaths({
          coin: "Dogecoin",
          accountIdx: 0,
        });

        expect(paths).toHaveLength(1);
        expect(paths[0]).toEqual({
          coin: "Dogecoin",
          scriptType: core.BTCInputScriptType.SpendAddress,
          addressNList: [0x80000000 + 44, 0x80000000 + 3, 0x80000000 + 0, 0, 0],
        });
      });

      it("should return correct paths for BitcoinCash (BIP44)", () => {
        const paths = wallet.btcGetAccountPaths({
          coin: "BitcoinCash",
          accountIdx: 0,
        });

        expect(paths).toHaveLength(1);
        expect(paths[0]).toEqual({
          coin: "BitcoinCash",
          scriptType: core.BTCInputScriptType.SpendAddress,
          addressNList: [0x80000000 + 44, 0x80000000 + 145, 0x80000000 + 0, 0, 0],
        });
      });

      it("should return correct paths for Zcash (BIP44)", () => {
        const paths = wallet.btcGetAccountPaths({
          coin: "Zcash",
          accountIdx: 0,
        });

        expect(paths).toHaveLength(1);
        expect(paths[0]).toEqual({
          coin: "Zcash",
          scriptType: core.BTCInputScriptType.SpendAddress,
          addressNList: [0x80000000 + 44, 0x80000000 + 133, 0x80000000 + 0, 0, 0],
        });
      });

      it("should filter paths by scriptType when specified", () => {
        const paths = wallet.btcGetAccountPaths({
          coin: "Bitcoin",
          accountIdx: 0,
          scriptType: core.BTCInputScriptType.SpendWitness,
        });

        expect(paths).toHaveLength(1);
        expect(paths[0].scriptType).toBe(core.BTCInputScriptType.SpendWitness);
      });

      it("should return empty array for unsupported coin", () => {
        const paths = wallet.btcGetAccountPaths({
          coin: "UnsupportedCoin" as any,
          accountIdx: 0,
        });

        expect(paths).toHaveLength(0);
      });
    });

    describe("btcSupportsScriptType", () => {
      it("should support SpendWitness for Bitcoin", async () => {
        const result = await wallet.btcSupportsScriptType("Bitcoin", core.BTCInputScriptType.SpendWitness);
        expect(result).toBe(true);
      });

      it("should support SpendWitness for Litecoin", async () => {
        const result = await wallet.btcSupportsScriptType("Litecoin", core.BTCInputScriptType.SpendWitness);
        expect(result).toBe(true);
      });

      it("should NOT support SpendWitness for Dash", async () => {
        const result = await wallet.btcSupportsScriptType("Dash", core.BTCInputScriptType.SpendWitness);
        expect(result).toBe(false);
      });

      it("should NOT support SpendWitness for Dogecoin", async () => {
        const result = await wallet.btcSupportsScriptType("Dogecoin", core.BTCInputScriptType.SpendWitness);
        expect(result).toBe(false);
      });

      it("should NOT support SpendWitness for BitcoinCash", async () => {
        const result = await wallet.btcSupportsScriptType("BitcoinCash", core.BTCInputScriptType.SpendWitness);
        expect(result).toBe(false);
      });

      it("should NOT support SpendWitness for Zcash", async () => {
        const result = await wallet.btcSupportsScriptType("Zcash", core.BTCInputScriptType.SpendWitness);
        expect(result).toBe(false);
      });

      it("should support SpendAddress for Dash", async () => {
        const result = await wallet.btcSupportsScriptType("Dash", core.BTCInputScriptType.SpendAddress);
        expect(result).toBe(true);
      });

      it("should support SpendAddress for Dogecoin", async () => {
        const result = await wallet.btcSupportsScriptType("Dogecoin", core.BTCInputScriptType.SpendAddress);
        expect(result).toBe(true);
      });

      it("should support SpendAddress for BitcoinCash", async () => {
        const result = await wallet.btcSupportsScriptType("BitcoinCash", core.BTCInputScriptType.SpendAddress);
        expect(result).toBe(true);
      });

      it("should support SpendAddress for Zcash", async () => {
        const result = await wallet.btcSupportsScriptType("Zcash", core.BTCInputScriptType.SpendAddress);
        expect(result).toBe(true);
      });

      it("should NOT support SpendAddress for Bitcoin", async () => {
        const result = await wallet.btcSupportsScriptType("Bitcoin", core.BTCInputScriptType.SpendAddress);
        expect(result).toBe(false);
      });

      it("should NOT support SpendAddress for Litecoin", async () => {
        const result = await wallet.btcSupportsScriptType("Litecoin", core.BTCInputScriptType.SpendAddress);
        expect(result).toBe(false);
      });

      it("should NOT support SpendP2SHWitness for any coin", async () => {
        const coins = ["Bitcoin", "Litecoin", "Dash", "Dogecoin", "BitcoinCash", "Zcash"];
        for (const coin of coins) {
          const result = await wallet.btcSupportsScriptType(coin, core.BTCInputScriptType.SpendP2SHWitness);
          expect(result).toBe(false);
        }
      });

      it("should NOT support unsupported script types", async () => {
        const coins = ["Bitcoin", "Litecoin", "Dash", "Dogecoin", "BitcoinCash", "Zcash"];
        for (const coin of coins) {
          const result = await wallet.btcSupportsScriptType(coin, "UnsupportedScriptType" as any);
          expect(result).toBe(false);
        }
      });

      it("should return false for unsupported coin", async () => {
        const result = await wallet.btcSupportsScriptType(
          "UnsupportedCoin" as any,
          core.BTCInputScriptType.SpendWitness
        );
        expect(result).toBe(false);
      });
    });
  });

  describe("Solana", () => {
    it("solanaGetAddress returns a valid address", async () => {
      wallet.solanaProvider = {
        connect: jest.fn().mockReturnValue({
          publicKey: "DsYwEVzeSNMkU5PVwjwtZ8EDRQxaR6paXfFAdhMQxmaV",
        }),
      } as unknown as VultisigSolanaProvider;

      const address = await wallet.solanaGetAddress();

      expect(address).toEqual("DsYwEVzeSNMkU5PVwjwtZ8EDRQxaR6paXfFAdhMQxmaV");
    });
  });

  // TODO: hippo: Missing tests for Thorchain and Cosmos
});
