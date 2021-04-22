import * as core from "@shapeshiftoss/hdwallet-core";
import * as NativeHDWallet from "./native";

const MNEMONIC = "all all all all all all all all all all all all";

const mswMock = require("mswMock")().startServer();
afterEach(() => expect(mswMock).not.toHaveBeenCalled());

const untouchable = require("untouchableMock");

describe("NativeKavaWalletInfo", () => {
  const info = NativeHDWallet.info();

  it("should return some static metadata", async () => {
    await expect(untouchable.call(info, "kavaSupportsNetwork")).resolves.toBe(true);
    await expect(untouchable.call(info, "kavaSupportsSecureTransfer")).resolves.toBe(false);
    expect(untouchable.call(info, "kavaSupportsNativeShapeShift")).toBe(false);
  });

  it("should return the correct account paths", async () => {
    const paths = info.kavaGetAccountPaths({ accountIdx: 0 });
    expect(paths).toMatchObject([{ addressNList: core.bip32ToAddressNList("m/44'/459'/0'/0/0") }]);
  });

  it("does not support getting the next account path", async () => {
    expect(untouchable.call(info, "kavaNextAccountPath", {})).toBe(undefined);
  });
});

describe("NativeKavaWallet", () => {
  let wallet: NativeHDWallet.NativeHDWallet;

  beforeEach(async () => {
    wallet = NativeHDWallet.create({ deviceId: "native" });
    await wallet.loadDevice({ mnemonic: MNEMONIC });
    await expect(wallet.initialize()).resolves.toBe(true);
  });

  it("should generate a correct kava address", async () => {
    await expect(
      wallet.kavaGetAddress({ addressNList: core.bip32ToAddressNList("m/44'/459'/0'/0/0") })
    ).resolves.toBe("kava1x9eec99f6m9d0nc3my4uyw55jefkcxj8dwxcpu");
  });

  it("should generate another correct kava address", async () => {
    await expect(
      wallet.kavaGetAddress({ addressNList: core.bip32ToAddressNList("m/44'/459'/1337'/123/4") })
    ).resolves.toBe("kava1yhys0syftn2f624lue6fsxyql74r3evvljchjt");
  });

  it("does not support signing transactions", async () => {
    await expect(wallet.kavaSignTx({
      addressNList: core.bip32ToAddressNList("m/44'/459'/0'/0/0"),
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
