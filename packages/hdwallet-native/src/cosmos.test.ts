import * as core from "@shapeshiftoss/hdwallet-core";
import * as NativeHDWallet from "./native";

const MNEMONIC = "all all all all all all all all all all all all";

const mswMock = require("mswMock")().startServer();
afterEach(() => expect(mswMock).not.toHaveBeenCalled());

const untouchable = require("untouchableMock");

describe("NativeCosmosWalletInfo", () => {
  const info = NativeHDWallet.info();

  it("should return some static metadata", async () => {
    await expect(untouchable.call(info, "cosmosSupportsNetwork")).resolves.toBe(true);
    await expect(untouchable.call(info, "cosmosSupportsSecureTransfer")).resolves.toBe(false);
    expect(untouchable.call(info, "cosmosSupportsNativeShapeShift")).toBe(false);
  });

  it("should return the correct account paths", async () => {
    const paths = info.cosmosGetAccountPaths({ accountIdx: 0 });
    expect(paths).toMatchObject([{ addressNList: core.bip32ToAddressNList("m/44'/118'/0'/0/0") }]);
  });

  it("does not support getting the next account path", async()=>{
    expect(untouchable.call(info, "cosmosNextAccountPath", {})).toBe(undefined);
  })
});
