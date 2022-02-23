import * as core from "@shapeshiftoss/hdwallet-core";

import * as native from "./native";

const MNEMONIC = "all all all all all all all all all all all all";

const mswMock = require("mswMock")().startServer();
afterEach(() => expect(mswMock).not.toHaveBeenCalled());

const untouchable = require("untouchableMock");

describe("NativeCosmosWalletInfo", () => {
  const info = native.info();

  it("should return some static metadata", async () => {
    expect(await untouchable.call(info, "cosmosSupportsNetwork")).toBe(true);
    expect(await untouchable.call(info, "cosmosSupportsSecureTransfer")).toBe(false);
    expect(untouchable.call(info, "cosmosSupportsNativeShapeShift")).toBe(false);
  });

  it("should return the correct account paths", async () => {
    const paths = info.cosmosGetAccountPaths({ accountIdx: 0 });
    expect(paths).toMatchObject([{ addressNList: core.bip32ToAddressNList("m/44'/118'/0'/0/0") }]);
  });

  it("does not support getting the next account path", async () => {
    expect(untouchable.call(info, "cosmosNextAccountPath", {})).toBe(undefined);
  });
});

describe("NativeCosmosWallet", () => {
  let wallet: native.NativeHDWallet;

  beforeEach(async () => {
    wallet = native.create({ deviceId: "native" });
    await wallet.loadDevice({ mnemonic: MNEMONIC });
    expect(await wallet.initialize()).toBe(true);
  });

  it("should generate a correct cosmos address", async () => {
    expect(
      await wallet.cosmosGetAddress({ addressNList: core.bip32ToAddressNList("m/44'/118'/0'/0/0") })
    ).toBe("cosmos1knuunh0lmwyrkjmrj7sky49uxk3peyzhzsvqqf");
  });

  it("should generate another correct cosmos address", async () => {
    expect(
      await wallet.cosmosGetAddress({ addressNList: core.bip32ToAddressNList("m/44'/118'/1337'/123/4") })
    ).toBe("cosmos14k4dnrrmxdch6nkvvuugsywrgmvlwrqszjfxjt");
  });

  it.skip("should sign a transaction correctly", async () => {
    const signed = await wallet.cosmosSignTx({
      addressNList: core.bip32ToAddressNList("m/44'/118'/0'/0/0"),
      tx: {
        msg: [{ type: "foo", value: "bar" }],
        fee: {
          "amount": [
            {
              "amount": "100",
              "denom": "uatom"
            }
          ],
          "gas": "100000"
        },
        signatures: null,
        memo: "foobar",
      },
      chain_id: "cosmoshub-4",
      account_number: "16359",
      sequence: "17",
    });
    await expect(signed?.signatures?.length).toBe(1);
    await expect(signed?.signatures?.[0].pub_key?.value).toMatchInlineSnapshot(
      `"AuGwbxSqxtP4HsVyUqrWiAZfb7Ur+gKYcAQ+Ru8mIBxQ"`
    );
    await expect(signed?.signatures?.[0]).toMatchInlineSnapshot(
      `"n8E8bEJmm9LZ/oZ3Zp1C4dP29IdZ8bzP67frNlzkR+58UKT0Qj8N485PtN62TiKPmYFuHBn9EeKHWoWV2U8Xxg=="`
    );
  });
});
