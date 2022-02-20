import * as core from "@shapeshiftoss/hdwallet-core";
import * as bitcoin from "./bitcoin";

describe("XDEFI - BitcoinAdapter", () => {
  it("btcGetAddress returns a valid address ", async () => {
    const bitcoinProvider = {
      request: jest
        .fn()
        .mockImplementationOnce((_method, cb) => cb(null, ["bc1qannfxke2tfd4l7vhepehpvt05y83v3qsf6nfkk"])),
    };

    const address = await bitcoin.btcGetAddress(bitcoinProvider);

    expect(address).toBe("bc1qannfxke2tfd4l7vhepehpvt05y83v3qsf6nfkk");
  });
  it("btcGetAddress throws error if bitcoinProvider is not found ", async () => {
    try {
      await bitcoin.btcGetAddress(undefined);
    } catch (e) {
      expect(e.message).toBe("XDEFI Provider not found");
    }
  });
  it("btcSignTx returns a valid signature ", async () => {
    const bitcoinProvider = {
      request: jest
        .fn()
        .mockImplementationOnce((_method, cb) => cb(null, { signatures: [], serializedTx: "randomSerializedTx" })),
    };

    const result = await bitcoin.btcSignTx(
      { coin: "Bitcoin", inputs: [], outputs: [], version: 1, locktime: 0 },
      "bc1qannfxke2tfd4l7vhepehpvt05y83v3qsf6nfkk",
      bitcoinProvider
    );

    expect(result).toMatchObject({ signatures: [], serializedTx: "randomSerializedTx" });
  });

  it("btcSignTx throws error if bitcoinProvider is not found ", async () => {
    try {
      await bitcoin.btcSignTx(
        { coin: "Bitcoin", inputs: [], outputs: [], version: 1, locktime: 0 },
        "bc1qannfxke2tfd4l7vhepehpvt05y83v3qsf6nfkk",
        undefined
      );
    } catch (e) {
      expect(e.message).toBe("XDEFI Provider not found");
    }
  });
  it("btcSignMessage returns a valid signature ", async () => {
    const bitcoinProvider = {
      request: jest.fn().mockImplementationOnce((_method, cb) => cb(null, "randomSig")),
    };

    const result = await bitcoin.btcSignMessage(
      {
        addressNList: core.bip32ToAddressNList("m/44'/0'/0'/0/0"),
        coin: "Bitcoin",
        scriptType: core.BTCInputScriptType.SpendAddress,
        message: "Hello World",
      },
      "bc1qannfxke2tfd4l7vhepehpvt05y83v3qsf6nfkk",
      bitcoinProvider
    );

    expect(result).toMatchObject({ address: "bc1qannfxke2tfd4l7vhepehpvt05y83v3qsf6nfkk", signature: "randomSig" });
  });

  it("btcSignMessage throws error if bitcoinProvider is not found ", async () => {
    try {
      await bitcoin.btcSignMessage(
        {
          addressNList: core.bip32ToAddressNList("m/44'/0'/0'/0/0"),
          coin: "Bitcoin",
          scriptType: core.BTCInputScriptType.SpendAddress,
          message: "Hello World",
        },
        "bc1qannfxke2tfd4l7vhepehpvt05y83v3qsf6nfkk",
        undefined
      );
    } catch (e) {
      expect(e.message).toBe("XDEFI Provider not found");
    }
  });
  it("btcVerifyMessage returns true for correct signature ", async () => {
    const result = await bitcoin.btcVerifyMessage({
      address: "1FH6ehAd5ZFXCM1cLGzHxK1s4dGdq1JusM",
      coin: "Bitcoin",
      signature:
        "20a037c911044cd6c851b6508317d8892067b0b62074b2cf1c0df9abd4aa053a3c243ffdc37f64d7af2c857128eafc81947c380995596615e5dcc313a15f512cdd",
      message: "Hello World",
    });

    expect(result).toBe(true);
  });
  it("btcVerifyMessage returns false for incorrect signature ", async () => {
    const result = await bitcoin.btcVerifyMessage({
      address: "1FH6ehAd5ZFXCM1cLGzHxK1s4dGdq1JusM",
      coin: "Bitcoin",
      signature: "incorrectSig",
      message: "Hello World",
    });

    expect(result).toBe(false);
  });
  it("btcSupportsCoin returns true for supported coin ", async () => {
    const result = await bitcoin.btcSupportsCoin("Bitcoin");

    expect(result).toBe(true);
  });
  it("btcSupportsCoin returns false for unsupported coin ", async () => {
    const result = await bitcoin.btcSupportsCoin("unsupportedCoin");

    expect(result).toBe(false);
  });
  it("btcSupportsScriptType returns true for supported scriptType ", async () => {
    const result = await bitcoin.btcSupportsScriptType("Bitcoin", core.BTCInputScriptType.SpendAddress);

    expect(result).toBe(true);
  });

  it("btcSupportsScriptType returns false for unsupported scriptType ", async () => {
    const result = await bitcoin.btcSupportsScriptType("Bitcoin", core.BTCInputScriptType.Bech32);

    expect(result).toBe(false);
  });
});
