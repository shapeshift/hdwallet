import * as core from "@shapeshiftoss/hdwallet-core";

import { TallyHoHDWallet, TallyHoHDWalletInfo } from ".";

describe("HDWalletInfo", () => {
  const info = new TallyHoHDWalletInfo();

  it("should have correct metadata", async () => {
    expect(info.getVendor()).toBe("Tally Ho");
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
  it("should produce correct path descriptions", () => {
    expect(info.hasNativeShapeShift()).toBe(false);
    [
      {
        msg: { coin: "Ethereum", path: [44 + 0x80000000, 60 + 0x80000000, 0 + 0x80000000, 0, 0] },
        out: { coin: "Ethereum", verbose: "Ethereum Account #0", isKnown: true },
      },
    ].forEach((x) => expect(info.describePath(x.msg)).toMatchObject(x.out));
    expect(() => info.describePath({ coin: "foobar", path: [1, 2, 3] })).toThrowError("Unsupported path");
  });
});

describe("TallyHoHDWallet", () => {
  let wallet: TallyHoHDWallet;
  beforeEach(() => {
    wallet = new TallyHoHDWallet(core.untouchable("TallyHoHDWallet:provider"));
    wallet.ethAddress = "0x73d0385F4d8E00C5e6504C6030F47BF6212736A8";
  });

  it("should match the metadata", async () => {
    expect(wallet.getVendor()).toBe("Tally Ho");
    expect(wallet.hasOnDevicePinEntry()).toBe(false);
    expect(wallet.hasOnDevicePassphrase()).toBe(true);
    expect(wallet.hasOnDeviceDisplay()).toBe(true);
    expect(wallet.hasOnDeviceRecovery()).toBe(true);
    expect(await wallet.ethSupportsNetwork(1)).toBe(true);
    expect(await wallet.ethSupportsSecureTransfer()).toBe(false);
    expect(wallet.ethSupportsNativeShapeShift()).toBe(false);
    expect(await wallet.ethSupportsEIP1559()).toBe(true);
    expect(await wallet.supportsOfflineSigning()).toBe(false);
    expect(await wallet.supportsBroadcast()).toBe(true);
  });

  it("should test ethSignTx", async () => {
    wallet.ethAddress = "0x123";
    wallet.provider = {
      request: jest.fn().mockReturnValue({
        r: "0x63db3dd3bf3e1fe7dde1969c0fc8850e34116d0b501c0483a0e08c0f77b8ce0a",
        s: "0x28297d012cccf389f6332415e96ee3fc0bbf8474d05f646e029cd281a031464b",
        v: 38,
        serialized:
          "0xf86b018501dcd650008256229412ec06288edd7ae2cc41a843fe089237fc7354f0872c68af0bb140008026a063db3dd3bf3e1fe7dde1969c0fc8850e34116d0b501c0483a0e08c0f77b8ce0aa028297d012cccf389f6332415e96ee3fc0bbf8474d05f646e029cd281a031464b",
      }),
    };
    expect(
      await wallet.ethSignTx({
        addressNList: core.bip32ToAddressNList("m/44'/60'/0'/0/0"),
        nonce: "0xDEADBEEF",
        gasPrice: "0xDEADBEEF",
        gasLimit: "0xDEADBEEF",
        to: "0xDEADBEEFDEADBEEFDEADBEEFDEADBEEFDEADBEEF",
        value: "0xDEADBEEFDEADBEEFDEADBEEFDEADBEEF",
        data: "0xDEADBEEFDEADBEEFDEADBEEFDEADBEEF",
        chainId: 1,
      })
    ).toEqual(null);
  });

  it("should test ethSignMessage", async () => {
    wallet.provider = {
      request: jest.fn().mockReturnValue(
        `Object {
          "address": "0x73d0385F4d8E00C5e6504C6030F47BF6212736A8",
          "signature": "0x05f51140905ffa33ffdc57f46b0b8d8fbb1d2a99f8cd843ca27893c01c31351c08b76d83dce412731c846e3b50649724415deb522d00950fbf4f2c1459c2b70b1b",
        }`
      ),
    };
    const msg = "super secret message";
    expect(
      await wallet.ethSignMessage({
        addressNList: core.bip32ToAddressNList("m/44'/60'/0'/0/0"),
        message: msg,
      })
    ).toMatchInlineSnapshot(`
    Object {
      "address": "0x73d0385F4d8E00C5e6504C6030F47BF6212736A8",
      "signature": "Object {
              \\"address\\": \\"0x73d0385F4d8E00C5e6504C6030F47BF6212736A8\\",
              \\"signature\\": \\"0x05f51140905ffa33ffdc57f46b0b8d8fbb1d2a99f8cd843ca27893c01c31351c08b76d83dce412731c846e3b50649724415deb522d00950fbf4f2c1459c2b70b1b\\",
            }",
    }
  `);
  });

  it("ethSignMessage returns null on error", async () => {
    wallet.provider = {
      request: jest.fn().mockRejectedValue(new Error("An Error has occurred")),
    };

    const msg = "super secret message";
    const sig = await wallet.ethSignMessage({
      addressNList: core.bip32ToAddressNList("m/44'/60'/0'/0/0"),
      message: msg,
    });

    expect(sig).toBe(null);
  });

  it("ethGetAddress returns a valid address", async () => {
    wallet.provider = {
      request: jest.fn().mockReturnValue(["0x73d0385F4d8E00C5e6504C6030F47BF6212736A8"]),
    };

    const msg = "super secret message";
    const sig = await wallet.ethSignMessage({
      addressNList: core.bip32ToAddressNList("m/44'/60'/0'/0/0"),
      message: msg,
    });

    expect(sig).toMatchObject({
      address: "0x73d0385F4d8E00C5e6504C6030F47BF6212736A8",
      signature: ["0x73d0385F4d8E00C5e6504C6030F47BF6212736A8"],
    });
  });
  it("ethSendTx returns a valid hash", async () => {
    wallet.provider = {
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
    expect(wallet.provider.request).toHaveBeenCalled();
    expect(hash).toMatchObject({ hash: "0x123" });
  });
  it("ethSendTx returns a valid hash if maxFeePerGas is present in msg", async () => {
    wallet.provider = {
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
    expect(wallet.provider.request).toHaveBeenCalled();
    expect(hash).toMatchObject({ hash: "0x123" });
  });
  it("ethSendTx returns null on error", async () => {
    wallet.provider = {
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
    expect(wallet.provider.request).toHaveBeenCalled();
    expect(hash).toBe(null);
  });
  it("ethVerifyMessage returns null as its not implemented", async () => {
    wallet.provider = {
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
