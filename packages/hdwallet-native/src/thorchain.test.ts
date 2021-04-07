import * as core from "@shapeshiftoss/hdwallet-core";
import * as NativeHDWallet from "./native";

const MNEMONIC = "all all all all all all all all all all all all";

const mswMock = require("mswMock")().startServer();
afterEach(() => expect(mswMock).not.toHaveBeenCalled());

const untouchable = require("untouchableMock");

describe("NativeThorchainWalletInfo", () => {
  const info = NativeHDWallet.info();

  it("should return some static metadata", async () => {
    await expect(untouchable.call(info, "thorchainSupportsNetwork")).resolves.toBe(true);
    await expect(untouchable.call(info, "thorchainSupportsSecureTransfer")).resolves.toBe(false);
    expect(untouchable.call(info, "thorchainSupportsNativeShapeShift")).toBe(false);
  });

  it("should return the correct account paths", async () => {
    const paths = info.thorchainGetAccountPaths({ accountIdx: 0 });
    expect(paths).toMatchObject([{ addressNList: core.bip32ToAddressNList("m/44'/931'/0'/0/0") }]);
  });

  it("does not support getting the next account path", async () => {
    expect(untouchable.call(info, "thorchainNextAccountPath", {})).toBe(undefined);
  });
});

describe("NativeThorchainWallet", () => {
  let wallet: NativeHDWallet.NativeHDWallet;

  beforeEach(async () => {
    wallet = NativeHDWallet.create({ deviceId: "native" });
    await wallet.loadDevice({ mnemonic: MNEMONIC });
    await expect(wallet.initialize()).resolves.toBe(true);
  });

  it("should generate a correct thorchain address", async () => {
    await expect(
      wallet.thorchainGetAddress({ addressNList: core.bip32ToAddressNList("m/44'/931'/0'/0/0") })
    ).resolves.toBe("thor1ujumx36gj3jv33gcw49dfafdddza3kdcd38paq");
  });

  it("should generate another correct thorchain address", async () => {
    await expect(
      wallet.thorchainGetAddress({ addressNList: core.bip32ToAddressNList("m/44'/931'/1337'/123/4") })
    ).resolves.toBe("thor14hqwsy4qpwzsdk2l3h3q82eghg4ctaa38rx63g");
  });

  it("should sign a transaction correctly", async () => {
    const signed = await wallet.thorchainSignTx({
      addressNList: core.bip32ToAddressNList("m/44'/931'/0'/0/0"),
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
    await expect(signed.signatures.length).toBe(1);
    await expect(signed.signatures[0].pub_key.value).toMatchInlineSnapshot(
      `"A1DSQ2pqr8D5di36Uj6M/sbvkSi7nMf/07yMwcBXyJHL"`
    );
    await expect(signed.signatures[0].signature).toMatchInlineSnapshot(
      `"3fYykzgna7MWg9VLhsYwHMEF55ZHQEmefq5KOH0jRtNDOYc2K0J9ss3sts54i5I52sg5dA4aGC/yJuSDGUlUJQ=="`
    );
  });
});
