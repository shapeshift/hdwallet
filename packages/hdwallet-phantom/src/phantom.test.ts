import * as core from "@shapeshiftoss/hdwallet-core";

import { PhantomHDWallet, PhantomHDWalletInfo } from ".";
import { PhantomUtxoProvider } from "./types";

describe("HDWalletInfo", () => {
  const info = new PhantomHDWalletInfo();

  it("should have correct metadata", async () => {
    expect(info.getVendor()).toBe("Phantom");
    expect(info.hasOnDevicePinEntry()).toBe(false);
    expect(info.hasOnDevicePassphrase()).toBe(true);
    expect(info.hasOnDeviceDisplay()).toBe(true);
    expect(info.hasOnDeviceRecovery()).toBe(true);
    expect(await info.ethSupportsNetwork(1)).toBe(true);
    expect(await info.ethSupportsSecureTransfer()).toBe(false);
    expect(info.ethSupportsNativeShapeShift()).toBe(false);
    expect(await info.ethSupportsEIP1559()).toBe(true);
    expect(await info.supportsOfflineSigning()).toBe(false);
    expect(await info.supportsBroadcast()).toBe(true);
  });
});

describe("PhantomHDWallet", () => {
  let wallet: PhantomHDWallet;
  beforeEach(() => {
    wallet = new PhantomHDWallet(
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
    expect(await wallet.supportsOfflineSigning()).toBe(false);
    expect(wallet.supportsBip44Accounts()).toBe(false);
    expect(await wallet.supportsBroadcast()).toBe(true);
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

  it("ethGetAddress returns a valid address", async () => {
    wallet.evmProvider = {
      _metamask: {
        isUnlocked: () => true,
      },
      request: jest.fn().mockReturnValue(["0x73d0385F4d8E00C5e6504C6030F47BF6212736A8"]),
    };

    const address = await wallet.ethGetAddress();

    expect(address).toEqual("0x73d0385F4d8E00C5e6504C6030F47BF6212736A8");
  });
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
  it("ethVerifyMessage returns null as its not implemented", async () => {
    wallet.evmProvider = {
      _metamask: {
        isUnlocked: () => true,
      },
      request: jest.fn().mockReturnValue("0x3f2329C9ADFbcCd9A84f52c906E936A42dA18CB8"),
    };
    expect(
      await wallet.ethVerifyMessage({
        address: "0x3f2329C9ADFbcCd9A84f52c906E936A42dA18CB8",
        message: "hello world",
        signature:
          "0x29f7212ecc1c76cea81174af267b67506f754ea8c73f144afa900a0d85b24b21319621aeb062903e856352f38305710190869c3ce5a1425d65ef4fa558d0fc251b",
      })
    ).toEqual(null);
  });
});
