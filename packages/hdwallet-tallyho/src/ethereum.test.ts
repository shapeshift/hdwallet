import * as core from "@shapeshiftoss/hdwallet-core";

import * as ethereum from "./ethereum";

describe("Tally Ho - Ethereum Adapter", () => {
  it("ethVerifyMessage returns null as its not implemented", async () => {
    const ethereumProvider = {
      request: jest.fn().mockReturnValue("0x3f2329C9ADFbcCd9A84f52c906E936A42dA18CB8"),
    };
    expect(
      await ethereum.ethVerifyMessage(
        {
          address: "0x3f2329C9ADFbcCd9A84f52c906E936A42dA18CB8",
          message: "hello world",
          signature:
            "0x29f7212ecc1c76cea81174af267b67506f754ea8c73f144afa900a0d85b24b21319621aeb062903e856352f38305710190869c3ce5a1425d65ef4fa558d0fc251b",
        },
        ethereumProvider
      )
    ).toBe(null);
  });
  it("ethGetAccountPaths should return correct paths", () => {
    const paths = ethereum.ethGetAccountPaths({ coin: "Ethereum", accountIdx: 0 });
    expect(paths).toMatchObject([
      {
        addressNList: core.bip32ToAddressNList("m/44'/60'/0'/0/0"),
        hardenedPath: core.bip32ToAddressNList("m/44'/60'/0'"),
        relPath: [0, 0],
        description: "Tally Ho",
      },
    ]);
  });
  it("ethGetAccountPaths should return empty path", () => {
    const paths = ethereum.ethGetAccountPaths({ coin: "RandomCoin", accountIdx: 0 });
    expect(paths).toMatchObject([]);
  });
  it("ethSignTx returns null as its not implemented", async () => {
    const ethereumProvider = {
      request: jest.fn().mockReturnValue({
        r: "0x63db3dd3bf3e1fe7dde1969c0fc8850e34116d0b501c0483a0e08c0f77b8ce0a",
        s: "0x28297d012cccf389f6332415e96ee3fc0bbf8474d05f646e029cd281a031464b",
        v: 38,
        serialized:
          "0xf86b018501dcd650008256229412ec06288edd7ae2cc41a843fe089237fc7354f0872c68af0bb140008026a063db3dd3bf3e1fe7dde1969c0fc8850e34116d0b501c0483a0e08c0f77b8ce0aa028297d012cccf389f6332415e96ee3fc0bbf8474d05f646e029cd281a031464b",
      }),
    };
    expect(
      await ethereum.ethSignTx(
        {
          addressNList: core.bip32ToAddressNList("m/44'/60'/0'/0/0"),
          nonce: "0xDEADBEEF",
          gasPrice: "0xDEADBEEF",
          gasLimit: "0xDEADBEEF",
          to: "0xDEADBEEFDEADBEEFDEADBEEFDEADBEEFDEADBEEF",
          value: "0xDEADBEEFDEADBEEFDEADBEEFDEADBEEF",
          data: "0xDEADBEEFDEADBEEFDEADBEEFDEADBEEF",
          chainId: 1,
        },
        ethereumProvider,
        "0x123"
      )
    ).toEqual(null);
  });
  it("ethSendTx returns a valid hash", async () => {
    const ethereumProvider = {
      request: jest.fn().mockReturnValue("0x123"),
    };

    const hash = await ethereum.ethSendTx(
      {
        addressNList: core.bip32ToAddressNList("m/44'/60'/0'/0/0"),
        nonce: "0xDEADBEEF",
        gasPrice: "0xDEADBEEF",
        gasLimit: "0xDEADBEEF",
        to: "0xDEADBEEFDEADBEEFDEADBEEFDEADBEEFDEADBEEF",
        value: "0xDEADBEEFDEADBEEFDEADBEEFDEADBEEF",
        data: "0xDEADBEEFDEADBEEFDEADBEEFDEADBEEF",
        chainId: 1,
      },
      ethereumProvider,
      "0x123"
    );
    expect(ethereumProvider.request).toHaveBeenCalled();
    expect(hash).toMatchObject({ hash: "0x123" });
  });
  it("ethSendTx returns a valid hash if maxFeePerGas is present in msg", async () => {
    const ethereumProvider = {
      request: jest.fn().mockReturnValue("0x123"),
    };

    const hash = await ethereum.ethSendTx(
      {
        addressNList: core.bip32ToAddressNList("m/44'/60'/0'/0/0"),
        nonce: "0xDEADBEEF",
        gasLimit: "0xDEADBEEF",
        maxFeePerGas: "0xDEADBEEF",
        to: "0xDEADBEEFDEADBEEFDEADBEEFDEADBEEFDEADBEEF",
        value: "0xDEADBEEFDEADBEEFDEADBEEFDEADBEEF",
        data: "0xDEADBEEFDEADBEEFDEADBEEFDEADBEEF",
        chainId: 1,
      },
      ethereumProvider,
      "0x123"
    );
    expect(ethereumProvider.request).toHaveBeenCalled();
    expect(hash).toMatchObject({ hash: "0x123" });
  });
  it("ethSendTx returns null on error", async () => {
    const ethereumProvider = {
      request: jest.fn().mockRejectedValue(new Error("An Error has occurred")),
    };

    const hash = await ethereum.ethSendTx(
      {
        addressNList: core.bip32ToAddressNList("m/44'/60'/0'/0/0"),
        nonce: "0xDEADBEEF",
        gasPrice: "0xDEADBEEF",
        gasLimit: "0xDEADBEEF",
        to: "0xDEADBEEFDEADBEEFDEADBEEFDEADBEEFDEADBEEF",
        value: "0xDEADBEEFDEADBEEFDEADBEEFDEADBEEF",
        data: "0xDEADBEEFDEADBEEFDEADBEEFDEADBEEF",
        chainId: 1,
      },
      ethereumProvider,
      "0x123"
    );
    expect(ethereumProvider.request).toHaveBeenCalled();
    expect(hash).toBe(null);
  });

  it("ethSignMessage returns a valid signature object", async () => {
    const ethereumProvider = {
      request: jest.fn().mockReturnValue(
        `Object {
          "address": "0x73d0385F4d8E00C5e6504C6030F47BF6212736A8",
          "signature": "0x05f51140905ffa33ffdc57f46b0b8d8fbb1d2a99f8cd843ca27893c01c31351c08b76d83dce412731c846e3b50649724415deb522d00950fbf4f2c1459c2b70b1b",
        }`
      ),
    };

    const msg = "super secret message";
    const sig = await ethereum.ethSignMessage(
      {
        addressNList: core.bip32ToAddressNList("m/44'/60'/0'/0/0"),
        message: msg,
      },
      ethereumProvider,
      "0x73d0385F4d8E00C5e6504C6030F47BF6212736A8"
    );

    expect(sig).toMatchInlineSnapshot(`
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
    const ethereumProvider = {
      request: jest.fn().mockRejectedValue(new Error("An Error has occurred")),
    };

    const msg = "super secret message";
    const sig = await ethereum.ethSignMessage(
      {
        addressNList: core.bip32ToAddressNList("m/44'/60'/0'/0/0"),
        message: msg,
      },
      ethereumProvider,
      "0x73d0385F4d8E00C5e6504C6030F47BF6212736A8"
    );

    expect(sig).toBe(null);
  });

  it("ethGetAddress returns a valid address", async () => {
    const ethereumProvider = {
      request: jest.fn().mockReturnValue(["0x73d0385F4d8E00C5e6504C6030F47BF6212736A8"]),
    };

    const address = await ethereum.ethGetAddress(ethereumProvider);

    expect(address).toBe("0x73d0385F4d8E00C5e6504C6030F47BF6212736A8");
  });
  it("ethGetAddress returns null on error", async () => {
    const ethereumProvider = {
      request: jest.fn().mockRejectedValue(new Error("An error has occurred")),
    };

    const address = await ethereum.ethGetAddress(ethereumProvider);

    expect(address).toBe(null);
  });
  it("ethGetAddress returns null if no provider", async () => {
    const ethereumProvider = {};

    const address = await ethereum.ethGetAddress(ethereumProvider);

    expect(address).toBe(null);
  });
});
