import * as NativeHDWallet from "./native";
import * as bip39 from "bip39";

const MNEMONIC = "all all all all all all all all all all all all";

describe("hdwallet-native", () => {
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
      await wallet.loadDevice({ mnemonic: MNEMONIC });
      await expect(wallet.initialize()).resolves.toBe(true);
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
});
