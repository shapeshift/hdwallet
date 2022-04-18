import * as core from "@shapeshiftoss/hdwallet-core";

import { XDeFiAdapter } from "./adapter";
import { XDeFiHDWallet } from "./xdefi";

describe("XDeFiAdapter", () => {
  it("throws error if provider is not preset", async () => {
    const keyring = new core.Keyring();
    const adapter = XDeFiAdapter.useKeyring(keyring);
    expect(await adapter.initialize()).toBe(0);
    await expect(async () => await adapter.pairDevice()).rejects.toThrowError("XDeFi provider not found");
  });
  it("creates a unique wallet per deviceId", async () => {
    Object.defineProperty(globalThis, "xfi", {
      value: { ethereum: { request: jest.fn().mockReturnValue(["0x123"]) } },
    });
    const keyring = new core.Keyring();
    const adapter = XDeFiAdapter.useKeyring(keyring);
    const add = jest.spyOn(adapter.keyring, "add");
    expect(await adapter.initialize()).toBe(0);
    const wallet = await adapter.pairDevice();
    expect(wallet).toBeInstanceOf(XDeFiHDWallet);
    expect(add).toBeCalled();
    expect(await wallet.getDeviceID()).toBe("xDeFi:0x123");
  });
});
