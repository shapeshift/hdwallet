import { NativeHDWallet } from "./native";

describe("hdwallet-native", () => {
  it("should keep mnemonic private", () => {
    const wallet = new NativeHDWallet({ mnemonic: "all all all all all all all all all", deviceId: "deviceId" });
    const json = JSON.stringify(wallet);
    expect(json).not.toMatch(/mnemonic|all/);
    expect(Object.getOwnPropertyNames(wallet).filter((p) => p.includes("mnemonic")).length).toBe(0);
    expect(require("util").inspect(wallet, { showHidden: true }).includes("mnemonic")).toBe(false);
  });
});
