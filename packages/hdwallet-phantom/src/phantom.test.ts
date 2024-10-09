import * as core from "@shapeshiftoss/hdwallet-core";

import { PhantomHDWallet } from ".";
import { PhantomSolanaProvider, PhantomUtxoProvider } from "./types";

describe("PhantomHDWallet", () => {
  let wallet: PhantomHDWallet;

  beforeEach(() => {
    wallet = new PhantomHDWallet(
      core.untouchable("PhantomHDWallet:provider"),
      core.untouchable("PhantomHDWallet:provider"),
      core.untouchable("PhantomHDWallet:provider")
    );
  });

  it("should match the metadata", async () => {
    expect(wallet.getVendor()).toBe("Phantom");
    expect(wallet.hasOnDevicePinEntry()).toBe(false);
    expect(wallet.hasOnDevicePassphrase()).toBe(true);
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
        _metamask: {
          isUnlocked: () => true,
        },
        request: jest.fn().mockReturnValue(["0x73d0385F4d8E00C5e6504C6030F47BF6212736A8"]),
      };

      const address = await wallet.ethGetAddress({ addressNList: core.bip32ToAddressNList("m/44'/60'/0'/0/0") });

      expect(address).toEqual("0x73d0385F4d8E00C5e6504C6030F47BF6212736A8");
    });

    it("ethSendTx returns a valid hash", async () => {
      wallet.evmProvider = {
        _metamask: {
          isUnlocked: () => true,
        },
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
        _metamask: {
          isUnlocked: () => true,
        },
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
        _metamask: {
          isUnlocked: () => true,
        },
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
        _metamask: {
          isUnlocked: () => true,
        },
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
        _metamask: {
          isUnlocked: () => true,
        },
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
        requestAccounts: jest.fn().mockReturnValue([
          {
            purpose: "payment",
            address: "bc1q9sjm947kn2hz84syykmem7dshvevm8xm5dkrpg",
          },
        ]),
      } as unknown as PhantomUtxoProvider;

      const address = await wallet.btcGetAddress({
        coin: "Bitcoin",
      } as core.BTCGetAddress);

      expect(address).toEqual("bc1q9sjm947kn2hz84syykmem7dshvevm8xm5dkrpg");
    });
  });

  describe("Solana", () => {
    it("solanaGetAddress returns a valid address", async () => {
      wallet.solanaProvider = {
        connect: jest.fn().mockReturnValue({
          publicKey: "DsYwEVzeSNMkU5PVwjwtZ8EDRQxaR6paXfFAdhMQxmaV",
        }),
      } as unknown as PhantomSolanaProvider;

      const address = await wallet.solanaGetAddress();

      expect(address).toEqual("DsYwEVzeSNMkU5PVwjwtZ8EDRQxaR6paXfFAdhMQxmaV");
    });
  });
});
