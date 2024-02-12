import * as core from "@shapeshiftoss/hdwallet-core";

import * as native from "./native";

const MNEMONIC = "all all all all all all all all all all all all";

const mswMock = require("mswMock")().startServer();
afterEach(() => expect(mswMock).not.toHaveBeenCalled());

const untouchable = require("untouchableMock");

describe("NativeTerraWalletInfo", () => {
  const info = native.info();

  it("should return some static metadata", async () => {
    await expect(untouchable.call(info, "terraSupportsNetwork")).resolves.toBe(true);
    await expect(untouchable.call(info, "terraSupportsSecureTransfer")).resolves.toBe(false);
    expect(untouchable.call(info, "terraSupportsNativeShapeShift")).toBe(false);
  });

  it("should return the correct account paths", async () => {
    const paths = info.terraGetAccountPaths({ accountIdx: 0 });
    expect(paths).toMatchObject([{ addressNList: core.bip32ToAddressNList("m/44'/330'/0'/0/0") }]);
  });

  it("does not support getting the next account path", async () => {
    expect(untouchable.call(info, "terraNextAccountPath", {})).toBe(undefined);
  });
});

describe("NativeTerraWallet", () => {
  let wallet: native.NativeHDWallet;

  beforeEach(async () => {
    wallet = native.create({ deviceId: "native" });
    await wallet.loadDevice({ mnemonic: MNEMONIC });
    await expect(wallet.initialize()).resolves.toBe(true);
  });

  it("should generate a correct terra address", async () => {
    await expect(wallet.terraGetAddress({ addressNList: core.bip32ToAddressNList("m/44'/330'/0'/0/0") })).resolves.toBe(
      "terra1f95csal3u6cyyj23ept3x7ap3u247npf8u2yhz"
    );
  });

  it("should generate another correct terra address", async () => {
    await expect(
      wallet.terraGetAddress({ addressNList: core.bip32ToAddressNList("m/44'/330'/1337'/123/4") })
    ).resolves.toBe("terra153l3gzmg5xlr8aldndpcg7achjejre04azdf9q");
  });

  it("does not support signing transactions", async () => {
    const signed = await wallet.terraSignTx({
      addressNList: core.bip32ToAddressNList("m/44'/330'/0'/0/0"),
      tx: {
        msg: [{ type: "foo", value: "bar" }],
        fee: {
          amount: [{ denom: "foo", amount: "bar" }],
          gas: "baz",
        },
        signatures: null,
        memo: "foobar",
      },
      chain_id: "foobar",
      account_number: "foo",
      sequence: "bar",
    });
    expect(signed.signatures.length).toBe(1);
    expect(signed.signatures[0].pub_key.value).toMatchInlineSnapshot(`"A6cAUgKWL3/P3nQY+j2fMUBaAW/QC/FGmQzTJ4nqXo0E"`);
    expect(signed.signatures[0].signature).toMatchInlineSnapshot(
      `"zUPR10sr2QwRa10fcb3z/KC6/mWuLq0iff5ImhylIJpqU1RSg49Jxbmvp07D3sWuY0fE5mcSdMWQXWJFw2zsWQ=="`
    );
  });
});
