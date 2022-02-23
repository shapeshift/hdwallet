import * as core from "@shapeshiftoss/hdwallet-core";
import { create, XDeFiHDWallet } from ".";

import * as xdefi from "./xdefi";

describe("XDeFIHDWalletInfo", () => {
  it("should have correct metadata", async () => {
    const info = xdefi.info();
    expect(info.getVendor()).toBe("XDeFi");
    expect(info.hasOnDevicePinEntry()).toBe(false);
    expect(info.hasOnDevicePassphrase()).toBe(false);
    expect(info.hasOnDeviceDisplay()).toBe(false);
    expect(info.hasOnDeviceRecovery()).toBe(false);
    expect(await info.ethSupportsNetwork(1)).toBe(true);
    expect(await info.ethSupportsSecureTransfer()).toBe(false);
    expect(info.ethSupportsNativeShapeShift()).toBe(false);
    expect(await info.ethSupportsEIP1559()).toBe(true);
    expect(await info.supportsOfflineSigning()).toBe(false);
    expect(await info.supportsBroadcast()).toBe(true);
  });
  it("should produce correct path descriptions", () => {
    const info = xdefi.info();
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

describe("XDeFiWHDWallet", () => {
  let wallet: XDeFiHDWallet;
  beforeEach(() => {
    const provider: { [key: string]: any } = { eth: {} };
    wallet = new XDeFiHDWallet();
    wallet.ethAddress = "0x73d0385F4d8E00C5e6504C6030F47BF6212736A8";
    wallet.initialize(provider);
    wallet.provider = provider;
  });

  it("should match the metadata", async () => {
    expect(wallet.getVendor()).toBe("XDeFi");
    expect(wallet.hasOnDevicePinEntry()).toBe(false);
    expect(wallet.hasOnDevicePassphrase()).toBe(false);
    expect(wallet.hasOnDeviceDisplay()).toBe(false);
    expect(wallet.hasOnDeviceRecovery()).toBe(false);
    expect(await wallet.ethSupportsNetwork(1)).toBe(true);
    expect(await wallet.ethSupportsSecureTransfer()).toBe(false);
    expect(wallet.ethSupportsNativeShapeShift()).toBe(false);
    expect(await wallet.ethSupportsEIP1559()).toBe(true);
    expect(await wallet.supportsOfflineSigning()).toBe(false);
    expect(await wallet.supportsBroadcast()).toBe(true);
  });

  it("should test ethSignTx", async () => {
    wallet.ethAddress = "0x123";
    wallet.bitcoinAddress = "bc1qannfxke2tfd4l7vhepehpvt05y83v3qsf6nfkk";
    wallet.provider["ethereum"] = {
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
    ).toEqual({
      r: "0x63db3dd3bf3e1fe7dde1969c0fc8850e34116d0b501c0483a0e08c0f77b8ce0a",
      s: "0x28297d012cccf389f6332415e96ee3fc0bbf8474d05f646e029cd281a031464b",
      v: 38,
      serialized:
        "0xf86b018501dcd650008256229412ec06288edd7ae2cc41a843fe089237fc7354f0872c68af0bb140008026a063db3dd3bf3e1fe7dde1969c0fc8850e34116d0b501c0483a0e08c0f77b8ce0aa028297d012cccf389f6332415e96ee3fc0bbf8474d05f646e029cd281a031464b",
    });
  });

  it("should test ethSignMessage", async () => {
    wallet.provider["ethereum"] = {
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

  it("ethGetAddress returns a valid address ", async () => {
    wallet.provider["ethereum"] = {
      request: jest.fn().mockReturnValue(["0x73d0385F4d8E00C5e6504C6030F47BF6212736A8"]),
    };

    const sig = await wallet.ethGetAddress();

    expect(sig).toBe("0x73d0385F4d8E00C5e6504C6030F47BF6212736A8");
  });
  it("ethSendTx returns a valid hash", async () => {
    wallet.provider["ethereum"] = {
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
    expect(wallet.provider["ethereum"].request).toHaveBeenCalled();
    expect(hash).toMatchObject({ hash: "0x123" });
  });
  it("ethSendTx returns a valid hash if maxFeePerGas is present in msg", async () => {
    wallet.provider["ethereum"] = {
      request: jest.fn().mockReturnValue("0x123"),
    };

    const hash = await wallet.ethSendTx({
      addressNList: core.bip32ToAddressNList("m/44'/60'/0'/0/0"),
      nonce: "0xDEADBEEF",
      gasPrice: "0xDEADBEEF",
      gasLimit: "0xDEADBEEF",
      maxFeePerGas: "0xDEADBEEF",
      to: "0xDEADBEEFDEADBEEFDEADBEEFDEADBEEFDEADBEEF",
      value: "0xDEADBEEFDEADBEEFDEADBEEFDEADBEEF",
      data: "0xDEADBEEFDEADBEEFDEADBEEFDEADBEEF",
      chainId: 1,
    });
    expect(wallet.provider["ethereum"].request).toHaveBeenCalled();
    expect(hash).toMatchObject({ hash: "0x123" });
  });
  it("ethSendTx returns null on error", async () => {
    wallet.provider["ethereum"] = {
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
    expect(wallet.provider["ethereum"].request).toHaveBeenCalled();
    expect(hash).toBe(null);
  });
  it("ethVerifyMessage returns null as its not implemented", async () => {
    wallet.provider["ethereum"] = {
      request: jest.fn().mockReturnValue("0x3f2329C9ADFbcCd9A84f52c906E936A42dA18CB8"),
    };
    expect(
      await wallet.ethVerifyMessage({
        address: "0x3f2329C9ADFbcCd9A84f52c906E936A42dA18CB8",
        message: "hello world",
        signature:
          "0x29f7212ecc1c76cea81174af267b67506f754ea8c73f144afa900a0d85b24b21319621aeb062903e856352f38305710190869c3ce5a1425d65ef4fa558d0fc251b",
      })
    ).toEqual(true);
  });

  it("btcGetAddress returns a valid bitcoin address ", async () => {
    wallet.provider["bitcoin"] = {
      request: jest
        .fn()
        .mockImplementationOnce((_method, cb) => cb(null, ["bc1qannfxke2tfd4l7vhepehpvt05y83v3qsf6nfkk"])),
    };

    const address = await wallet.btcGetAddress();
    expect(address).toBe("bc1qannfxke2tfd4l7vhepehpvt05y83v3qsf6nfkk");
  });
  it("btcGetAddress returns a litecoin address ", async () => {
    wallet.provider["litecoin"] = {
      request: jest
        .fn()
        .mockImplementationOnce((_method, cb) => cb(null, ["ltc1qf6pwfkw4wd0fetq2pfrwzlfknskjg6nyvt6ngv"])),
    };

    const address = await wallet.btcGetAddress({
      addressNList: [0x80000000 + 44, 0x80000000 + 2, 0x80000000 + 0, 0, 0],
      coin: "Litecoin",
      scriptType: core.BTCInputScriptType.SpendAddress,
      showDisplay: true,
    });

    expect(address).toBe("ltc1qf6pwfkw4wd0fetq2pfrwzlfknskjg6nyvt6ngv");
  });
  it("btcGetAddress returns a bch address ", async () => {
    wallet.provider["bitcoincash"] = {
      request: jest
        .fn()
        .mockImplementationOnce((_method, cb) => cb(null, ["qzqxk2q6rhy3j9fnnc00m08g4n5dm827xv2dmtjzzp"])),
    };

    const address = await wallet.btcGetAddress({
      addressNList: [0x80000000 + 44, 0x80000000 + 2, 0x80000000 + 0, 0, 0],
      coin: "Bitcoincash",
      scriptType: core.BTCInputScriptType.SpendAddress,
      showDisplay: true,
    });

    expect(address).toBe("qzqxk2q6rhy3j9fnnc00m08g4n5dm827xv2dmtjzzp");
  });
  it("btcSignTx returns a valid signature - BTC ", async () => {
    wallet.provider["bitcoin"] = {
      request: jest
        .fn()
        .mockImplementationOnce((_method, cb) => cb(null, ["bc1qannfxke2tfd4l7vhepehpvt05y83v3qsf6nfkk"]))
        .mockImplementationOnce((_method, cb) => cb(null, { signatures: [], serializedTx: "randomSerializedTx" })),
    };

    const result = await wallet.btcSignTx({ coin: "Bitcoin", inputs: [], outputs: [], version: 1, locktime: 0 });

    expect(result).toMatchObject({ signatures: [], serializedTx: "randomSerializedTx" });
  });
  it("btcSignTx returns a valid signature - LTC ", async () => {
    wallet.provider["litecoin"] = {
      request: jest
        .fn()
        .mockImplementationOnce((_method, cb) => cb(null, ["bc1qannfxke2tfd4l7vhepehpvt05y83v3qsf6nfkk"]))
        .mockImplementationOnce((_method, cb) => cb(null, { signatures: [], serializedTx: "randomSerializedTx" })),
    };

    const result = await wallet.btcSignTx({ coin: "Litecoin", inputs: [], outputs: [], version: 1, locktime: 0 });

    expect(result).toMatchObject({ signatures: [], serializedTx: "randomSerializedTx" });
  });
  it("btcSignTx returns a valid signature - BCH ", async () => {
    wallet.provider["bitcoincash"] = {
      request: jest
        .fn()
        .mockImplementationOnce((_method, cb) => cb(null, ["bc1qannfxke2tfd4l7vhepehpvt05y83v3qsf6nfkk"]))
        .mockImplementationOnce((_method, cb) => cb(null, { signatures: [], serializedTx: "randomSerializedTx" })),
    };

    const result = await wallet.btcSignTx({ coin: "Bitcoincash", inputs: [], outputs: [], version: 1, locktime: 0 });

    expect(result).toMatchObject({ signatures: [], serializedTx: "randomSerializedTx" });
  });
  it("btcSignMessage returns a valid signature - BTC", async () => {
    wallet.provider["bitcoin"] = {
      request: jest
        .fn()
        .mockImplementationOnce((_method, cb) => cb(null, ["bc1qannfxke2tfd4l7vhepehpvt05y83v3qsf6nfkk"]))
        .mockImplementationOnce((_method, cb) => cb(null, "randomSig")),
    };

    const result = await wallet.btcSignMessage({
      addressNList: core.bip32ToAddressNList("m/44'/0'/0'/0/0"),
      coin: "Bitcoin",
      scriptType: core.BTCInputScriptType.SpendAddress,
      message: "Hello World",
    });

    expect(result).toMatchObject({ address: "bc1qannfxke2tfd4l7vhepehpvt05y83v3qsf6nfkk", signature: "randomSig" });
  });
  it("btcSignMessage returns a valid signature - LTC", async () => {
    wallet.provider["litecoin"] = {
      request: jest
        .fn()
        .mockImplementationOnce((_method, cb) => cb(null, ["bc1qannfxke2tfd4l7vhepehpvt05y83v3qsf6nfkk"]))
        .mockImplementationOnce((_method, cb) => cb(null, "randomSig")),
    };

    const result = await wallet.btcSignMessage({
      addressNList: core.bip32ToAddressNList("m/44'/0'/0'/0/0"),
      coin: "Litecoin",
      scriptType: core.BTCInputScriptType.SpendAddress,
      message: "Hello World",
    });

    expect(result).toMatchObject({ address: "bc1qannfxke2tfd4l7vhepehpvt05y83v3qsf6nfkk", signature: "randomSig" });
  });
  it("btcSignMessage returns a valid signature - BCH", async () => {
    wallet.provider["bitcoincash"] = {
      request: jest
        .fn()
        .mockImplementationOnce((_method, cb) => cb(null, ["bc1qannfxke2tfd4l7vhepehpvt05y83v3qsf6nfkk"]))
        .mockImplementationOnce((_method, cb) => cb(null, "randomSig")),
    };

    const result = await wallet.btcSignMessage({
      addressNList: core.bip32ToAddressNList("m/44'/0'/0'/0/0"),
      coin: "Bitcoincash",
      scriptType: core.BTCInputScriptType.SpendAddress,
      message: "Hello World",
    });

    expect(result).toMatchObject({ address: "bc1qannfxke2tfd4l7vhepehpvt05y83v3qsf6nfkk", signature: "randomSig" });
  });
  it("btcVerifyMessage returns true for correct signature ", async () => {
    wallet.btcVerifyMessage = jest.fn().mockReturnValue(true);
    const result = await wallet.btcVerifyMessage({
      address: "1FH6ehAd5ZFXCM1cLGzHxK1s4dGdq1JusM",
      coin: "Bitcoin",
      signature: "correctSign",
      message: "Hello World",
    });

    expect(result).toBe(true);
  });
  it("btcVerifyMessage returns false for incorrect signature ", async () => {
    wallet.btcVerifyMessage = jest.fn().mockReturnValue(false);
    const result = await wallet.btcVerifyMessage({
      address: "1FH6ehAd5ZFXCM1cLGzHxK1s4dGdq1JusM",
      coin: "Bitcoin",
      signature: "incorrectSig",
      message: "Hello World",
    });

    expect(result).toBe(false);
  });
  it("btcSupportsCoin returns true for supported coin ", async () => {
    wallet.btcSupportsCoin = jest.fn().mockReturnValue(true);
    const result = await wallet.btcSupportsCoin("supportedCoin");

    expect(result).toBe(true);
  });
  it("btcSupportsCoin returns false for unsupported coin ", async () => {
    wallet.btcSupportsCoin = jest.fn().mockReturnValue(false);
    const result = await wallet.btcSupportsCoin("unsupportedCoin");

    expect(result).toBe(false);
  });

  it("btcSupportsScriptType returns true for supported scriptType ", async () => {
    wallet.btcSupportsScriptType = jest.fn().mockReturnValue(true);
    const result = await wallet.btcSupportsScriptType("Bitcoin", core.BTCInputScriptType.SpendAddress);

    expect(result).toBe(true);
  });

  it("btcSupportsScriptType returns false for unsupported scriptType ", async () => {
    wallet.btcSupportsScriptType = jest.fn().mockReturnValue(false);
    const result = await wallet.btcSupportsScriptType("Bitcoin", core.BTCInputScriptType.SpendAddress);

    expect(result).toBe(false);
  });

  it("should create instance of XDeFiHD wallet", () => {
    const wallet = create();
    expect(wallet).toBeInstanceOf(XDeFiHDWallet);
  });
});
