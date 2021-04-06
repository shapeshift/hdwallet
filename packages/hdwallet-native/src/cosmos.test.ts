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

  it("does not support getting the next account path", async () => {
    expect(untouchable.call(info, "cosmosNextAccountPath", {})).toBe(undefined);
  });
});

describe("NativeCosmosWallet", () => {
  let wallet: NativeHDWallet.NativeHDWallet;

  beforeEach(async () => {
    wallet = NativeHDWallet.create({ deviceId: "native" });
    await wallet.loadDevice({ mnemonic: MNEMONIC });
    await expect(wallet.initialize()).resolves.toBe(true);
  });

  it("should generate a correct cosmos address", async () => {
    await expect(
      wallet.cosmosGetAddress({ addressNList: core.bip32ToAddressNList("m/44'/118'/0'/0/0") })
    ).resolves.toBe("cosmos1knuunh0lmwyrkjmrj7sky49uxk3peyzhzsvqqf");
  });

  it("should generate another correct cosmos address", async () => {
    await expect(
      wallet.cosmosGetAddress({ addressNList: core.bip32ToAddressNList("m/44'/118'/1337'/123/4") })
    ).resolves.toBe("cosmos14k4dnrrmxdch6nkvvuugsywrgmvlwrqszjfxjt");
  });

  it("should sign a transaction correctly", async () => {
    const signed = await wallet.cosmosSignTx({
      addressNList: core.bip32ToAddressNList("m/44'/118'/0'/0/0"),
      tx: {
        msg: [{ type: "foo", value: "bar" }],
        fee: {
          amount: [{ denom: "foo", amount: "bar" }],
          gas: "baz",
        },
        signatures: null,
        memo: "foobar",
      },
      chain_id: "cosmoshub-4",
      account_number: "foo",
      sequence: "bar",
    });
    await expect(signed.signatures.length).toBe(1);
    await expect(signed.signatures[0].pub_key.value).toMatchInlineSnapshot(
      `"AuGwbxSqxtP4HsVyUqrWiAZfb7Ur+gKYcAQ+Ru8mIBxQ"`
    );
    await expect(signed.signatures[0].signature).toMatchInlineSnapshot(
      `"pWgTUZC5NUcqVrJJQL3BhLtIRcerd21H6EaTkkYIw/VGCau1hMDQDSKzKDvVICN7CSS4i1I7BhZs8nqF/E3Y9w=="`
    );
  });
});
