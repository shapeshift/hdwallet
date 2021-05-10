import { Keyring } from "@shapeshiftoss/hdwallet-core";
import { NativeAdapter } from "./adapter";
import { NativeHDWallet } from "./native";

describe("NativeAdapter", () => {
  it("creates a unique wallet per deviceId", async () => {
    const keyring = new Keyring();
    const adapter = NativeAdapter.useKeyring(keyring);
    expect(await adapter.initialize()).toBe(0);
    const wallet = await adapter.pairDevice("foobar");
    expect(wallet).toBeInstanceOf(NativeHDWallet);
    expect(await adapter.pairDevice("foobar")).toBe(wallet);
  });

  it("won't pair if the deviceId isn't specified", async () => {
    const keyring = new Keyring();
    const adapter = NativeAdapter.useKeyring(keyring);
    expect(await adapter.pairDevice(undefined)).toBe(null);
  });

  it("won't pair if a non-native wallet with the same deviceId is present in the keyring", async () => {
    const keyring = new Keyring();
    const adapter = NativeAdapter.useKeyring(keyring);
    const dummyWallet = {};
    keyring.add(dummyWallet as any, "foobar");
    expect(await adapter.pairDevice("foobar")).toBe(null);
  });
});
