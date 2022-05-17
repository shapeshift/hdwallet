import * as core from "@shapeshiftoss/hdwallet-core";

import { TallyHoAdapter } from "./adapter";

describe("TallyHoAdapter", () => {
  it("throws error if provider is not preset", async () => {
    const keyring = new core.Keyring();
    const adapter = TallyHoAdapter.useKeyring(keyring);
    await expect(async () => await adapter.pairDevice()).rejects.toThrowError("Could not get Tally Ho accounts.");
  });
});
