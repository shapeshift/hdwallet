import * as core from "@shapeshiftoss/hdwallet-core";

import { TallyAdapter } from "./adapter";
import { TallyHDWallet } from "./tally";

describe("TallyAdapter", () => {
    it("throws error if provider is not preset", async () => {
      const keyring = new core.Keyring();
      const adapter = TallyAdapter.useKeyring(keyring);
      expect(await adapter.initialize()).toBe(0);
      try {
        await adapter.pairDevice();
      } catch (e) {
        expect(e.message).toBe("Tally provider not found");
      }
    });
    it("creates a unique wallet per deviceId", async () => {
      Object.defineProperty(globalThis, "tally", {
        value: { ethereum: { request: jest.fn().mockReturnValue(["0x123"]) } },
      });
      const keyring = new core.Keyring();
      const adapter = TallyAdapter.useKeyring(keyring);
      const add = jest.spyOn(adapter.keyring, "add");
      expect(await adapter.initialize()).toBe(0);
      const wallet = await adapter.pairDevice();
      expect(wallet).toBeInstanceOf(TallyHDWallet);
      expect(add).toBeCalled();
      expect(await wallet.getDeviceID()).toBe("tally:0x123");
    });
  });
