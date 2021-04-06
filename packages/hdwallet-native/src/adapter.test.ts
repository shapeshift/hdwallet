import { Keyring } from "@shapeshiftoss/hdwallet-core";
import { NativeAdapter } from "./adapter";
import { NativeHDWallet } from "./native";

describe("NativeAdapter", () => {
  it("creates a unique wallet per deviceId", async () => {
    const keyring = new Keyring();
    const adapter = NativeAdapter.useKeyring(keyring);
    await expect(adapter.initialize()).resolves.toBe(0);
    const wallet = await adapter.pairDevice("foobar");
    expect(wallet).toBeInstanceOf(NativeHDWallet);
    await expect(adapter.pairDevice("foobar")).resolves.toBe(wallet);
  });

  it("won't pair if the deviceId isn't specified", async () => {
    const keyring = new Keyring();
    const adapter = NativeAdapter.useKeyring(keyring);
    await expect(adapter.pairDevice(undefined)).resolves.toBe(null);
  });

  it("won't pair if a non-native wallet with the same deviceId is present in the keyring", async () => {
    const keyring = new Keyring();
    const adapter = NativeAdapter.useKeyring(keyring);
    const dummyWallet = {};
    keyring.add(dummyWallet as any, "foobar");
    await expect(adapter.pairDevice("foobar")).resolves.toBe(null);
  });
});
