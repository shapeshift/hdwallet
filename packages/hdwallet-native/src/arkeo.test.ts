import * as core from "@shapeshiftoss/hdwallet-core";

import * as native from "./native";

const MNEMONIC = "all all all all all all all all all all all all";

const mswMock = require("mswMock")().startServer();
afterEach(() => expect(mswMock).not.toHaveBeenCalled());

const untouchable = require("untouchableMock");

describe("NativeArkeoWalletInfo", () => {
  const info = native.info();

  it("should return some static metadata", async () => {
    expect(await untouchable.call(info, "arkeoSupportsNetwork")).toBe(true);
    expect(await untouchable.call(info, "arkeoSupportsSecureTransfer")).toBe(false);
    expect(untouchable.call(info, "arkeoSupportsNativeShapeShift")).toBe(false);
  });

  it("should return the correct account paths", async () => {
    const paths = info.arkeoGetAccountPaths({ accountIdx: 0 });
    expect(paths).toMatchObject([{ addressNList: core.bip32ToAddressNList("m/44'/118'/0'/0/0") }]);
  });

  it("does not support getting the next account path", async () => {
    expect(untouchable.call(info, "arkeoNextAccountPath", {})).toBe(undefined);
  });
});

describe("NativeArkeoWallet", () => {
  let wallet: native.NativeHDWallet;

  beforeEach(async () => {
    wallet = native.create({ deviceId: "native" });
    await wallet.loadDevice({ mnemonic: MNEMONIC });
    expect(await wallet.initialize()).toBe(true);
  });

  it("should generate a correct arkeo address", async () => {
    expect(await wallet.arkeoGetAddress({ addressNList: core.bip32ToAddressNList("m/44'/118'/0'/0/0") })).toBe(
      "arkeo1knuunh0lmwyrkjmrj7sky49uxk3peyzhpse9av"
    );
  });

  it("should generate another correct arkeo address", async () => {
    expect(await wallet.arkeoGetAddress({ addressNList: core.bip32ToAddressNList("m/44'/118'/1337'/123/4") })).toBe(
      "arkeo14k4dnrrmxdch6nkvvuugsywrgmvlwrqspjur0w"
    );
  });

  it("should sign a transaction correctly", async () => {
    const signed = await wallet.arkeoSignTx({
      addressNList: core.bip32ToAddressNList("m/44'/118'/0'/0/0"),
      tx: {
        msg: [
          {
            type: "arkeo/BondProvider",
            value: {
              creator: "arkeo15cenya0tr7nm3tz2wn3h3zwkht2rxrq7r7z5sh",
              provider: "arkeo15cenya0tr7nm3tz2wn3h3zwkht2rxrq7r7z5sh",
              service: "test-service-string",
              bond: "10000",
            },
          },
        ],
        fee: {
          amount: [
            {
              amount: "2291",
              denom: "uarkeo",
            },
          ],
          gas: "91633",
        },
        signatures: [],
        memo: "foobar",
      },
      chain_id: "arkeo-mainnet-1",
      account_number: "97721",
      sequence: "90",
    });
    await expect(signed?.signatures?.length).toBe(1);
    await expect(signed?.signatures?.[0]).toMatchInlineSnapshot(
      `"nkq6+HHu7R2op3goq/UoyE6Ci4QyNFB8OFmNJRn0SSAHYKsl7J4AeItbuzZ+WapPhVdCbaAKlZoieQuAzHwW9A=="`
    );
  });
});
