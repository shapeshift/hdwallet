import * as core from "@shapeshiftoss/hdwallet-core";
import * as NativeHDWallet from "./native";

const MNEMONIC = "all all all all all all all all all all all all";

const mswMock = require("mswMock")().startServer();
afterEach(() => expect(mswMock).not.toHaveBeenCalled());

const untouchable = require("untouchableMock");

describe("NativeTerraWalletInfo", () => {
  const info = NativeHDWallet.info();

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
  let wallet: NativeHDWallet.NativeHDWallet;

  beforeEach(async () => {
    wallet = NativeHDWallet.create({ deviceId: "native" });
    await wallet.loadDevice({ mnemonic: MNEMONIC });
    await expect(wallet.initialize()).resolves.toBe(true);
  });

  it("should generate a correct terra address", async () => {
    await expect(
      wallet.terraGetAddress({ addressNList: core.bip32ToAddressNList("m/44'/330'/0'/0/0") })
    ).resolves.toBe("terra1f95csal3u6cyyj23ept3x7ap3u247npf8u2yhz");
  });

  it("should generate another correct terra address", async () => {
    await expect(
      wallet.terraGetAddress({ addressNList: core.bip32ToAddressNList("m/44'/330'/1337'/123/4") })
    ).resolves.toBe("terra153l3gzmg5xlr8aldndpcg7achjejre04azdf9q");
  });

  it("does not support signing transactions", async () => {
    await expect(wallet.terraSignTx({
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
    })).rejects.toThrowError("Not Supported");
  });
});
