import * as core from "@shapeshiftoss/hdwallet-core";

import { Node } from "./crypto/isolation/engines/default/bip32";
import { fromB64ToArray } from "./crypto/utils";
import * as native from "./native";

const MNEMONIC = "all all all all all all all all all all all all";

const PRIVATE_KEY = "oe5ysT50Qkvnh1q9JwLULQuvK7flK664UkVA/srziyY="; // root private key generated from the 'all all all' seed
const CHAIN_CODE = "UBS48IuLdtYu2dXcWEAQDfUWmcwYvdSIAPM3VgRd0tI="; // root chain code generated from the 'all all all' seed

const mswMock = require("mswMock")().startServer();
afterEach(() => expect(mswMock).not.toHaveBeenCalled());

const untouchable = require("untouchableMock");

describe("NativeHDWalletInfo", () => {
  it("should have correct metadata", () => {
    const info = native.info();
    expect(info.getVendor()).toBe("Native");
    expect(info.hasOnDevicePinEntry()).toBe(false);
    expect(info.hasOnDevicePassphrase()).toBe(false);
    expect(info.hasOnDeviceDisplay()).toBe(false);
    expect(info.hasOnDeviceRecovery()).toBe(false);
    expect(info.supportsBip44Accounts()).toBe(true);
  });
  it("should produce correct path descriptions", () => {
    const info = native.info();
    expect(info.hasNativeShapeShift()).toBe(false);
    [
      {
        msg: { coin: "bitcoin", path: [1, 2, 3] },
        out: { coin: "bitcoin", verbose: "m/1/2/3", isKnown: false },
      },
      {
        msg: {
          coin: "bitcoin",
          path: [44 + 0x80000000, 0 + 0x80000000, 0 + 0x80000000, 0, 0],
          scriptType: core.BTCInputScriptType.SpendAddress,
        },
        out: { coin: "bitcoin", verbose: "m/44'/0'/0'/0/0", isKnown: false },
      },
      {
        msg: {
          coin: "Bitcoin",
          path: [44 + 0x80000000, 0 + 0x80000000, 0 + 0x80000000],
          scriptType: core.BTCInputScriptType.SpendAddress,
        },
        out: { coin: "Bitcoin", verbose: "Bitcoin Account #0 (Legacy)", isKnown: true, wholeAccount: true },
      },
      {
        msg: {
          coin: "Bitcoin",
          path: [44 + 0x80000000, 0 + 0x80000000, 0 + 0x80000000, 0, 0],
          scriptType: core.BTCInputScriptType.SpendAddress,
        },
        out: { coin: "Bitcoin", verbose: "Bitcoin Account #0, Address #0 (Legacy)", isKnown: true },
      },
      {
        msg: { coin: "dash", path: [1, 2, 3], scriptType: core.BTCInputScriptType.SpendWitness },
        out: { coin: "dash", verbose: "m/1/2/3", scriptType: core.BTCInputScriptType.SpendWitness, isKnown: false },
      },
      {
        msg: { coin: "bitcoincash", path: [1, 2, 3] },
        out: { coin: "bitcoincash", verbose: "m/1/2/3", isKnown: false },
      },
      {
        msg: { coin: "ethereum", path: [44 + 0x80000000, 60 + 0x80000000, 0 + 0x80000000, 0, 0] },
        out: { coin: "Ethereum", verbose: "Ethereum Account #0", isKnown: true },
      },
      {
        msg: { coin: "atom", path: [44 + 0x80000000, 118 + 0x80000000, 0 + 0x80000000, 0, 0] },
        out: { coin: "Atom", verbose: "Cosmos Account #0", isKnown: true },
      },
      {
        msg: { coin: "binance", path: [44 + 0x80000000, 714 + 0x80000000, 0 + 0x80000000, 0, 0] },
        out: { coin: "Binance", verbose: "Binance Account #0", isKnown: true },
      },
      {
        msg: { coin: "fio", path: [44 + 0x80000000, 235 + 0x80000000, 0 + 0x80000000, 0, 0] },
        out: { coin: "Fio", verbose: "Fio Account #0", isKnown: true },
      },
      {
        msg: { coin: "rune", path: [44 + 0x80000000, 931 + 0x80000000, 0 + 0x80000000, 0, 0] },
        out: { coin: "Thorchain", verbose: "Thorchain Account #0", isKnown: true },
      },
      {
        msg: { coin: "secret", path: [44 + 0x80000000, 529 + 0x80000000, 0 + 0x80000000, 0, 0] },
        out: { coin: "Secret", verbose: "Secret Account #0", isKnown: true },
      },
      {
        msg: { coin: "luna", path: [44 + 0x80000000, 330 + 0x80000000, 0 + 0x80000000, 0, 0] },
        out: { coin: "Terra", verbose: "Terra Account #0", isKnown: true },
      },
      {
        msg: { coin: "kava", path: [44 + 0x80000000, 459 + 0x80000000, 0 + 0x80000000, 0, 0] },
        out: { coin: "Kava", verbose: "Kava Account #0", isKnown: true },
      },
      {
        msg: { coin: "Osmo", path: [44 + 0x80000000, 118 + 0x80000000, 0 + 0x80000000, 0, 0] },
        out: { coin: "Osmo", verbose: "Osmosis Account #0", isKnown: true },
      },
      {
        msg: { coin: "cacao", path: [44 + 0x80000000, 931 + 0x80000000, 0 + 0x80000000, 0, 0] },
        out: { coin: "Mayachain", verbose: "Mayachain Account #0", isKnown: true },
      },
    ].forEach((x) => expect(info.describePath(x.msg)).toMatchObject(x.out));
    expect(() => info.describePath({ coin: "foobar", path: [1, 2, 3] })).toThrowError("Unsupported path");
  });
  it("should return true for supportsBip44Accounts", async () => {
    expect(native.info().supportsBip44Accounts()).toBe(true);
  });
});

describe("NativeHDWallet", () => {
  it("should keep mnemonic private", () => {
    const wallet = native.create({ mnemonic: MNEMONIC, deviceId: "deviceId" });
    const json = JSON.stringify(wallet);
    expect(json).not.toMatch(/mnemonic|all/);
    expect(Object.getOwnPropertyNames(wallet).filter((p) => p.includes("mnemonic")).length).toBe(0);
    expect(require("util").inspect(wallet, { showHidden: true }).includes("mnemonic")).toBe(false);
  });

  describe("loadDevice", () => {
    it("should load wallet with a mnemonic", async () => {
      const wallet = native.create({ deviceId: "native" });
      expect(await wallet.isInitialized()).toBe(false);
      expect(await wallet.isLocked()).toBe(false);
      await wallet.loadDevice({ mnemonic: MNEMONIC });
      expect(await wallet.initialize()).toBe(true);
      expect(await wallet.isInitialized()).toBe(true);
      expect(await wallet.isLocked()).toBe(false);
      const testCases: Array<{ in: any; out: any }> = [
        {
          in: [{ coin: "bitcoin", addressNList: [] }],
          out: [
            {
              xpub: "xpub661MyMwAqRbcFLgDU7wpcEVubSF7NkswwmXBUkDiGUW6uopeUMys4AqKXNgpfZKRTLnpKQgffd6a2c3J8JxLkF1AQN17Pm9QYHEqEfo1Rsx",
            },
          ],
        },
        {
          in: [{ coin: "bitcoin", addressNList: [1 + 0x80000000, 2 + 0x80000000] }],
          out: [
            {
              xpub: "xpub6A4ydEAik39rFLs1hcm6XiwpFN5XKEf9tdAZWK23tkXmSr8bHmfYyfVt2nTskZQj3yYydcST2DLUFq2iJAELtTVfW9UNnnK8zBi8bzFcQVB",
            },
          ],
        },
        // Note how this produces the same xpub as the path above. This is not intuitive behavior, and is probably a bug.
        {
          in: [{ coin: "bitcoin", addressNList: [1 + 0x80000000, 2 + 0x80000000, 3] }],
          out: [
            {
              xpub: "xpub6A4ydEAik39rFLs1hcm6XiwpFN5XKEf9tdAZWK23tkXmSr8bHmfYyfVt2nTskZQj3yYydcST2DLUFq2iJAELtTVfW9UNnnK8zBi8bzFcQVB",
            },
          ],
        },
      ];
      for (const params of testCases) {
        expect(await wallet.getPublicKeys(params.in)).toStrictEqual(params.out);
      }
    });

    it("should load wallet with a root node", async () => {
      const node = await Node.create(fromB64ToArray(PRIVATE_KEY), fromB64ToArray(CHAIN_CODE));
      const wallet = native.create({ deviceId: "native", masterKey: node });
      expect(await wallet.isInitialized()).toBe(false);
      expect(await wallet.isLocked()).toBe(false);
      await wallet.loadDevice({ masterKey: node });
      expect(await wallet.initialize()).toBe(true);
      expect(await wallet.isInitialized()).toBe(true);
      expect(await wallet.isLocked()).toBe(false);
      const testCases: Array<{ in: any; out: any }> = [
        {
          in: [{ coin: "bitcoin", addressNList: [] }],
          out: [
            {
              xpub: "xpub661MyMwAqRbcFLgDU7wpcEVubSF7NkswwmXBUkDiGUW6uopeUMys4AqKXNgpfZKRTLnpKQgffd6a2c3J8JxLkF1AQN17Pm9QYHEqEfo1Rsx",
            },
          ],
        },
        {
          in: [{ coin: "bitcoin", addressNList: [1 + 0x80000000, 2 + 0x80000000] }],
          out: [
            {
              xpub: "xpub6A4ydEAik39rFLs1hcm6XiwpFN5XKEf9tdAZWK23tkXmSr8bHmfYyfVt2nTskZQj3yYydcST2DLUFq2iJAELtTVfW9UNnnK8zBi8bzFcQVB",
            },
          ],
        },
        // Note how this produces the same xpub as the path above. This is not intuitive behavior, and is probably a bug.
        {
          in: [{ coin: "bitcoin", addressNList: [1 + 0x80000000, 2 + 0x80000000, 3] }],
          out: [
            {
              xpub: "xpub6A4ydEAik39rFLs1hcm6XiwpFN5XKEf9tdAZWK23tkXmSr8bHmfYyfVt2nTskZQj3yYydcST2DLUFq2iJAELtTVfW9UNnnK8zBi8bzFcQVB",
            },
          ],
        },
      ];
      for (const params of testCases) {
        expect(await wallet.getPublicKeys(params.in)).toStrictEqual(params.out);
      }
    });

    it("should load wallet with a non-root node", async () => {
      /** NOTE: Private key and chain code for node at depth 2 was generated
       * using 'alcohol' 'woman' 'abuse' seed.
       */
      const PRIVATE_KEY_DEPTH_2 = "GNjTirvFO9+GTP2Mp+4tmJAWRhxVmgVopzGXLeGbsw4=";
      const CHAIN_CODE_DEPTH_2 = "mMkqCbitsaueXWZf1q4d0zHRMBctdZFhid4z8c8v9II=";
      const node = await Node.create(
        fromB64ToArray(PRIVATE_KEY_DEPTH_2),
        fromB64ToArray(CHAIN_CODE_DEPTH_2),
        "m/44'/0'"
      );
      const wallet = native.create({ deviceId: "native", masterKey: node });
      expect(await wallet.isInitialized()).toBe(false);
      expect(await wallet.isLocked()).toBe(false);
      await wallet.loadDevice({ masterKey: node });
      expect(await wallet.initialize()).toBe(true);
      expect(await wallet.isInitialized()).toBe(true);
      expect(await wallet.isLocked()).toBe(false);

      expect(
        await wallet.btcGetAddress({
          coin: "bitcoin",
          addressNList: [44 + 0x80000000, 0 + 0x80000000],
          scriptType: core.BTCInputScriptType.SpendAddress,
        })
      ).toStrictEqual("1Hvzdx2kSLHT93aTnEeDNDSo4DS1Wn3CML");
    });

    it("should generate valid UTXO addresses when initialized with a non-root node", async () => {
      /** NOTE: Private key and chain code for node at depth 2 was generated
       * using 'alcohol' 'woman' 'abuse' seed.
       */
      const PRIVATE_KEY_DEPTH_2 = "GNjTirvFO9+GTP2Mp+4tmJAWRhxVmgVopzGXLeGbsw4=";
      const CHAIN_CODE_DEPTH_2 = "mMkqCbitsaueXWZf1q4d0zHRMBctdZFhid4z8c8v9II=";

      const node = await Node.create(
        fromB64ToArray(PRIVATE_KEY_DEPTH_2),
        fromB64ToArray(CHAIN_CODE_DEPTH_2),
        "m/44'/0'"
      );
      const wallet = native.create({ deviceId: "native", masterKey: node });
      expect(await wallet.isInitialized()).toBe(false);
      expect(await wallet.isLocked()).toBe(false);
      await wallet.loadDevice({ masterKey: node });
      expect(await wallet.initialize()).toBe(true);
      expect(await wallet.isInitialized()).toBe(true);
      expect(await wallet.isLocked()).toBe(false);
      expect(
        await wallet.btcGetAddress({
          coin: "bitcoin",
          addressNList: [44 + 0x80000000, 0 + 0x80000000, 0 + 0x80000000, 0, 0],
          scriptType: core.BTCInputScriptType.SpendAddress,
        })
      ).toStrictEqual("1FH6ehAd5ZFXCM1cLGzHxK1s4dGdq1JusM");
    });

    it("should generate valid Cosmos-SDK addresses when initialized with a non-root node", async () => {
      /** NOTE: Private key and chain code for node at depth 2 was generated
       * using 'alcohol' 'woman' 'abuse' seed.
       */
      const PRIVATE_KEY_DEPTH_2 = "dbSElgfG40sz9QXOfAdw4CStHymWOj76YwCP/7J7gfg=";
      const CHAIN_CODE_DEPTH_2 = "pBbxxP1ydHOWjGXtMOeeCMqvtiVpJlM0OQIJS3gsUcY=";

      const node = await Node.create(
        fromB64ToArray(PRIVATE_KEY_DEPTH_2),
        fromB64ToArray(CHAIN_CODE_DEPTH_2),
        "m/44'/118'"
      );
      const wallet = native.create({ deviceId: "native", masterKey: node });
      expect(await wallet.isInitialized()).toBe(false);
      expect(await wallet.isLocked()).toBe(false);
      await wallet.loadDevice({ masterKey: node });
      expect(await wallet.initialize()).toBe(true);
      expect(await wallet.isInitialized()).toBe(true);
      expect(await wallet.isLocked()).toBe(false);
      expect(
        await wallet.cosmosGetAddress({
          addressNList: [44 + 0x80000000, 118 + 0x80000000, 0 + 0x80000000, 0, 0],
        })
      ).toStrictEqual("cosmos15cenya0tr7nm3tz2wn3h3zwkht2rxrq7q7h3dj");
    });

    it("should generate valid EVM addresses when initialized with a non-root node", async () => {
      /** NOTE: Private key and chain code for node at depth 2 was generated
       * using 'alcohol' 'woman' 'abuse' seed.
       */
      const PRIVATE_KEY_DEPTH_2 = "/z/nU3ZlAc3LMiIGaMzjPzGBKK55MXCv/NKLYnJ+4ZM=";
      const CHAIN_CODE_DEPTH_2 = "c7sxhcAlFHGVnu0Ui5zJBvWAcuFddqFdX7eUHjd4Aw4=";

      const node = await Node.create(
        fromB64ToArray(PRIVATE_KEY_DEPTH_2),
        fromB64ToArray(CHAIN_CODE_DEPTH_2),
        "m/44'/60'"
      );
      const wallet = native.create({ deviceId: "native", masterKey: node });
      expect(await wallet.isInitialized()).toBe(false);
      expect(await wallet.isLocked()).toBe(false);
      await wallet.loadDevice({ masterKey: node });
      expect(await wallet.initialize()).toBe(true);
      expect(await wallet.isInitialized()).toBe(true);
      expect(await wallet.isLocked()).toBe(false);
      expect(
        await wallet.ethGetAddress({
          addressNList: [44 + 0x80000000, 60 + 0x80000000, 0 + 0x80000000, 0, 0],
        })
      ).toStrictEqual("0x3f2329C9ADFbcCd9A84f52c906E936A42dA18CB8");
    });

    it("should throw when attempting to derive a key for a path that is not a child of the explicit path", async () => {
      const node = await Node.create(fromB64ToArray(PRIVATE_KEY), fromB64ToArray(CHAIN_CODE), "m/44'/0'/0'");
      const wallet = native.create({ deviceId: "native", masterKey: node });
      expect(await wallet.isInitialized()).toBe(false);
      expect(await wallet.isLocked()).toBe(false);
      await wallet.loadDevice({ masterKey: node });
      expect(await wallet.initialize()).toBe(true);
      expect(await wallet.isInitialized()).toBe(true);
      expect(await wallet.isLocked()).toBe(false);

      const testCases: Array<{ in: any }> = [
        {
          in: [
            {
              coin: "bitcoin",
              addressNList: [44 + 0x80000000, 0 + 0x80000000],
              curve: "secp256k1",
            },
          ],
        },
        {
          in: [
            {
              coin: "bitcoin",
              addressNList: [44 + 0x80000000, 60 + 0x80000000],
              curve: "secp256k1",
            },
          ],
        },
        {
          in: [
            {
              coin: "bitcoin",
              addressNList: [44 + 0x80000000, 0 + 0x80000000, 1 + 0x80000000],
              curve: "secp256k1",
            },
          ],
        },
        {
          in: [
            {
              coin: "bitcoin",
              addressNList: [44 + 0x80000000, 118 + 0x80000000, 0 + 0x80000000, 0, 0],
              curve: "secp256k1",
            },
          ],
        },
      ];
      for (const params of testCases) {
        await expect(wallet.getPublicKeys(params.in)).rejects.toThrowError("path is not a child of this node");
      }
    });

    it("should load wallet with a mnemonic and deviceId", async () => {
      const wallet = native.create({ deviceId: "native" });
      await wallet.loadDevice({ mnemonic: MNEMONIC, deviceId: "0SUnRnGkhCt0T5qk5YmK10v5u+lgHiMMu1R76uD7kHE=" });
      expect(await wallet.initialize()).toBe(true);
      expect(await wallet.getDeviceID()).toBe("0SUnRnGkhCt0T5qk5YmK10v5u+lgHiMMu1R76uD7kHE=");
    });

    it.each([[undefined], [null], [0], [[1, 2, 3]], [{}]])(
      "should not update the deviceId if it's not a string (%o)",
      async (param: any) => {
        const wallet = native.create({ deviceId: "native" });
        await wallet.loadDevice({ mnemonic: MNEMONIC, deviceId: param });
        expect(await wallet.getDeviceID()).toBe("native");
      }
    );

    it("should throw an error when loadDevice is missing its parameters", async () => {
      const wallet = native.create({ deviceId: "native" });
      await expect(wallet.loadDevice(undefined as any)).rejects.toThrow("Either [mnemonic] or [masterKey] is required");
    });

    it.each([[undefined]])("should throw an error if mnemonic is not a string (%o)", async (param: any) => {
      const wallet = native.create({ deviceId: "native" });
      await expect(wallet.loadDevice({ mnemonic: param })).rejects.toThrow(
        "Either [mnemonic] or [masterKey] is required"
      );
    });

    it.each([[null], [0], [[1, 2, 3]], [{}], [""], ["all all all all all all"]])(
      "should throw an error if mnemonic is not a string (%o)",
      async (param: any) => {
        const wallet = native.create({ deviceId: "native" });
        await expect(wallet.loadDevice({ mnemonic: param })).rejects.toThrow("Required property [mnemonic] is invalid");
      }
    );
    it("should return true for supportsBip44Accounts", async () => {
      const wallet = native.create({ deviceId: "native" });
      expect(wallet.supportsBip44Accounts()).toBe(true);
    });
  });

  it("should wipe if an error occurs during initialization", async () => {
    expect.assertions(6);
    const wallet = native.create({ deviceId: "native" });
    const masterKey = {
      getChainCode: () => {
        throw "mock error";
      },
    } as any;
    const mocks = [
      jest.spyOn(console, "error").mockImplementationOnce((msg, error) => {
        expect(msg).toMatch("NativeHDWallet:initialize:error");
        expect(error).toEqual("mock error");
      }),
      jest.spyOn(wallet, "wipe"),
    ];
    await wallet.loadDevice({ masterKey });
    expect(await wallet.initialize()).toBeFalsy();
    mocks.forEach((x) => {
      expect(x).toHaveBeenCalled();
      x.mockRestore();
    });
  });

  it("should have correct metadata", async () => {
    const deviceId = "foobar";
    const wallet = native.create({ deviceId });
    expect(await wallet.getFeatures()).toEqual({});
    expect(await wallet.getDeviceID()).toEqual(deviceId);
    expect(await wallet.getFirmwareVersion()).toEqual("Software");
    expect(await wallet.getModel()).toEqual("Native");
    expect(await wallet.getLabel()).toEqual("Native");
  });

  it("should emit MNEMONIC_REQUIRED when initialized without a mnemonic", async () => {
    const wallet = native.create({ deviceId: "native" });
    const mnemonicRequiredMock = jest.fn(({ message_type }) => {
      expect(message_type).toBe(native.NativeEvents.MNEMONIC_REQUIRED);
    });
    const readyMock = jest.fn(({ message_type }) => {
      expect(message_type).toBe(native.NativeEvents.READY);
    });
    wallet.events.addListener(native.NativeEvents.READY, readyMock);
    wallet.events.addListener(native.NativeEvents.MNEMONIC_REQUIRED, mnemonicRequiredMock);
    expect(await wallet.initialize()).toBe(null);
    expect(mnemonicRequiredMock).toHaveBeenCalled();
    expect(readyMock).not.toHaveBeenCalled();
  });

  it("should emit READY when initialized with a mnemonic", async () => {
    const wallet = native.create({ deviceId: "native" });
    const mnemonicRequiredMock = jest.fn(({ message_type }) => {
      expect(message_type).toBe(native.NativeEvents.MNEMONIC_REQUIRED);
    });
    const readyMock = jest.fn(({ message_type }) => {
      expect(message_type).toBe(native.NativeEvents.READY);
    });
    wallet.events.addListener(native.NativeEvents.READY, readyMock);
    wallet.events.addListener(native.NativeEvents.MNEMONIC_REQUIRED, mnemonicRequiredMock);
    await wallet.loadDevice({ mnemonic: MNEMONIC });
    expect(await wallet.initialize()).toBe(true);
    expect(mnemonicRequiredMock).not.toHaveBeenCalled();
    expect(readyMock).toHaveBeenCalled();
  });

  it("should emit MNEMONIC_REQUIRED when initialized after a wipe", async () => {
    const wallet = native.create({ deviceId: "native" });
    const mock = jest.fn();
    wallet.events.addListener(native.NativeEvents.MNEMONIC_REQUIRED, mock);
    await wallet.loadDevice({ mnemonic: MNEMONIC });
    expect(await wallet.initialize()).toBe(true);
    await wallet.wipe();
    expect(mock).not.toHaveBeenCalled();
    expect(await wallet.initialize()).toBe(null);
    expect(mock).toHaveBeenCalled();
  });

  it("should work with isNative", () => {
    const wallet = native.create({ deviceId: "native" });
    expect(native.isNative(wallet)).toBe(true);
  });

  it("should respond to .ping()", async () => {
    const wallet = native.create({ deviceId: "native" });
    expect(await wallet.ping({ msg: "pong" })).toEqual({ msg: "pong" });
  });

  describe("nothing happens", () => {
    const wallet = native.create({ deviceId: "native" });

    it.each([
      ["clearSession"],
      ["sendPin"],
      ["sendPassphrase"],
      ["sendCharacter"],
      ["sendWord"],
      ["cancel"],
      ["reset"],
      ["recover"],
    ])("when %s is called", async (methodName) => {
      expect(await untouchable.call(wallet, methodName)).toBe(undefined);
    });
  });
});
