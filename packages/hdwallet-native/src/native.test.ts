import * as NativeHDWallet from "./native";
import * as bip39 from "bip39";
import { BTCInputScriptType } from "@shapeshiftoss/hdwallet-core";

const MNEMONIC = "all all all all all all all all all all all all";

const mswMock = require("mswMock")().startServer();
afterEach(() => expect(mswMock).not.toHaveBeenCalled());

const untouchable = require("untouchableMock");

describe("NativeHDWalletInfo", () => {
  it("should have correct metadata", () => {
    const info = NativeHDWallet.info();
    expect(info.getVendor()).toBe("Native");
    expect(info.hasOnDevicePinEntry()).toBe(false);
    expect(info.hasOnDevicePassphrase()).toBe(false);
    expect(info.hasOnDeviceDisplay()).toBe(false);
    expect(info.hasOnDeviceRecovery()).toBe(false);
  });
  it("should produce correct path descriptions", () => {
    const info = NativeHDWallet.info();
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
          scriptType: BTCInputScriptType.SpendAddress,
        },
        out: { coin: "bitcoin", verbose: "m/44'/0'/0'/0/0", isKnown: false },
      },
      {
        msg: {
          coin: "Bitcoin",
          path: [44 + 0x80000000, 0 + 0x80000000, 0 + 0x80000000],
          scriptType: BTCInputScriptType.SpendAddress,
        },
        out: { coin: "Bitcoin", verbose: "Bitcoin Account #0 (Legacy)", isKnown: true, wholeAccount: true },
      },
      {
        msg: {
          coin: "Bitcoin",
          path: [44 + 0x80000000, 0 + 0x80000000, 0 + 0x80000000, 0, 0],
          scriptType: BTCInputScriptType.SpendAddress,
        },
        out: { coin: "Bitcoin", verbose: "Bitcoin Account #0, Address #0 (Legacy)", isKnown: true },
      },
      {
        msg: { coin: "dash", path: [1, 2, 3], scriptType: BTCInputScriptType.SpendWitness },
        out: { coin: "dash", verbose: "m/1/2/3", scriptType: BTCInputScriptType.SpendWitness, isKnown: false },
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
    ].forEach((x) => expect(info.describePath(x.msg)).toMatchObject(x.out));
    expect(() => info.describePath({ coin: "foobar", path: [1, 2, 3] })).toThrowError("Unsupported path");
  });
});

describe("NativeHDWallet", () => {
  it("should keep mnemonic private", () => {
    const wallet = NativeHDWallet.create({ mnemonic: MNEMONIC, deviceId: "deviceId" });
    const json = JSON.stringify(wallet);
    expect(json).not.toMatch(/mnemonic|all/);
    expect(Object.getOwnPropertyNames(wallet).filter((p) => p.includes("mnemonic")).length).toBe(0);
    expect(require("util").inspect(wallet, { showHidden: true }).includes("mnemonic")).toBe(false);
  });

  describe("loadDevice", () => {
    it("should load wallet with a mnemonic", async () => {
      const wallet = NativeHDWallet.create({ deviceId: "native" });
      await expect(wallet.isInitialized()).resolves.toBe(false);
      await expect(wallet.isLocked()).resolves.toBe(false);
      await wallet.loadDevice({ mnemonic: MNEMONIC });
      await expect(wallet.initialize()).resolves.toBe(true);
      await expect(wallet.isInitialized()).resolves.toBe(true);
      await expect(wallet.isLocked()).resolves.toBe(false);
    });

    it("should load wallet with a mnemonic and deviceId", async () => {
      const wallet = NativeHDWallet.create({ deviceId: "native" });
      await wallet.loadDevice({ mnemonic: MNEMONIC, deviceId: "0SUnRnGkhCt0T5qk5YmK10v5u+lgHiMMu1R76uD7kHE=" });
      await expect(wallet.initialize()).resolves.toBe(true);
      await expect(wallet.getDeviceID()).resolves.toBe("0SUnRnGkhCt0T5qk5YmK10v5u+lgHiMMu1R76uD7kHE=");
    });

    it.each([[undefined], [null], [0], [[1, 2, 3]], [{}]])(
      "should not update the deviceId if it's not a string (%o)",
      async (param: any) => {
        const wallet = NativeHDWallet.create({ deviceId: "native" });
        await wallet.loadDevice({ mnemonic: MNEMONIC, deviceId: param });
        await expect(wallet.getDeviceID()).resolves.toBe("native");
      }
    );

    it("should throw an error when loadDevice is missing its parameters", async () => {
      const wallet = NativeHDWallet.create({ deviceId: "native" });
      await expect(wallet.loadDevice(undefined)).rejects.toThrow("Required property [mnemonic] is missing or invalid");
    });

    it.each([[undefined], [null], [0], [[1, 2, 3]], [{}], [""], ["all all all all all all"]])(
      "should throw an error if mnemonic is not a string (%o)",
      async (param: any) => {
        const wallet = NativeHDWallet.create({ deviceId: "native" });
        await expect(wallet.loadDevice({ mnemonic: param })).rejects.toThrow(
          "Required property [mnemonic] is missing or invalid"
        );
      }
    );
  });

  it("should wipe if an error occurs during initialization", async () => {
    expect.assertions(7);
    const wallet = NativeHDWallet.create({ deviceId: "native" });
    await wallet.loadDevice({ mnemonic: MNEMONIC });
    const mocks = [
      jest.spyOn(bip39, "mnemonicToSeed").mockImplementationOnce(() => {
        throw "mock error";
      }),
      jest.spyOn(console, "error").mockImplementationOnce((msg, error) => {
        expect(msg).toMatch("NativeHDWallet:initialize:error");
        expect(error).toEqual("mock error");
      }),
      jest.spyOn(wallet, "wipe"),
    ];
    await expect(wallet.initialize()).resolves.toBe(false);
    mocks.forEach((x) => {
      expect(x).toHaveBeenCalled();
      x.mockRestore();
    });
  });

  it("should have correct metadata", async () => {
    const deviceId = "foobar";
    const wallet = NativeHDWallet.create({ deviceId });
    await expect(wallet.getFeatures()).resolves.toEqual({});
    await expect(wallet.getDeviceID()).resolves.toEqual(deviceId);
    await expect(wallet.getFirmwareVersion()).resolves.toEqual("Software");
    await expect(wallet.getModel()).resolves.toEqual("Native");
    await expect(wallet.getLabel()).resolves.toEqual("Native");
  });

  it("should emit MNEMONIC_REQUIRED when initialized without a mnemonic", async () => {
    const wallet = NativeHDWallet.create({ deviceId: "native" });
    const mnemonicRequiredMock = jest.fn(({ message_type }) => {
      expect(message_type).toBe(NativeHDWallet.NativeEvents.MNEMONIC_REQUIRED);
    });
    const readyMock = jest.fn(({ message_type }) => {
      expect(message_type).toBe(NativeHDWallet.NativeEvents.READY);
    });
    wallet.events.addListener(NativeHDWallet.NativeEvents.READY, readyMock);
    wallet.events.addListener(NativeHDWallet.NativeEvents.MNEMONIC_REQUIRED, mnemonicRequiredMock);
    await expect(wallet.initialize()).resolves.toBe(null);
    expect(mnemonicRequiredMock).toHaveBeenCalled();
    expect(readyMock).not.toHaveBeenCalled();
  });

  it("should emit READY when initialized with a mnemonic", async () => {
    const wallet = NativeHDWallet.create({ deviceId: "native" });
    const mnemonicRequiredMock = jest.fn(({ message_type }) => {
      expect(message_type).toBe(NativeHDWallet.NativeEvents.MNEMONIC_REQUIRED);
    });
    const readyMock = jest.fn(({ message_type }) => {
      expect(message_type).toBe(NativeHDWallet.NativeEvents.READY);
    });
    wallet.events.addListener(NativeHDWallet.NativeEvents.READY, readyMock);
    wallet.events.addListener(NativeHDWallet.NativeEvents.MNEMONIC_REQUIRED, mnemonicRequiredMock);
    await wallet.loadDevice({ mnemonic: MNEMONIC });
    await expect(wallet.initialize()).resolves.toBe(true);
    expect(mnemonicRequiredMock).not.toHaveBeenCalled();
    expect(readyMock).toHaveBeenCalled();
  });

  it("should emit MNEMONIC_REQUIRED when initialized after a wipe", async () => {
    const wallet = NativeHDWallet.create({ deviceId: "native" });
    const mock = jest.fn();
    wallet.events.addListener(NativeHDWallet.NativeEvents.MNEMONIC_REQUIRED, mock);
    await wallet.loadDevice({ mnemonic: MNEMONIC });
    await expect(wallet.initialize()).resolves.toBe(true);
    await wallet.wipe();
    expect(mock).not.toHaveBeenCalled();
    await expect(wallet.initialize()).resolves.toBe(null);
    expect(mock).toHaveBeenCalled();
  });

  it("should work with isNative", () => {
    const wallet = NativeHDWallet.create({ deviceId: "native" });
    expect(NativeHDWallet.isNative(wallet)).toBe(true);
  });

  it("should respond to .ping()", async () => {
    const wallet = NativeHDWallet.create({ deviceId: "native" });
    await expect(wallet.ping({ msg: "pong" })).resolves.toEqual({ msg: "pong" });
  });

  describe("nothing happens", () => {
    const wallet = NativeHDWallet.create({ deviceId: "native" });

    it.each([
      ["clearSession"],
      ["sendPin"],
      ["sendPassphrase"],
      ["sendCharacter"],
      ["sendWord"],
      ["cancel"],
      ["reset"],
      ["recover"],
      ["disconnect"],
    ])("when %s is called", async (methodName) => {
      await expect(untouchable.call(wallet, methodName)).resolves.toBe(undefined);
    });
  });
});
