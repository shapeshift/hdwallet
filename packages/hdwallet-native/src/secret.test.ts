import * as core from "@shapeshiftoss/hdwallet-core";

import * as native from "./native";

const MNEMONIC = "all all all all all all all all all all all all";

const mswMock = require("mswMock")().startServer();
afterEach(() => expect(mswMock).not.toHaveBeenCalled());

const untouchable = require("untouchableMock");

describe("NativeSecretWalletInfo", () => {
  const info = native.info();

  it("should return some static metadata", async () => {
    await expect(untouchable.call(info, "secretSupportsNetwork")).resolves.toBe(true);
    await expect(untouchable.call(info, "secretSupportsSecureTransfer")).resolves.toBe(false);
    expect(untouchable.call(info, "secretSupportsNativeShapeShift")).toBe(false);
  });

  it("should return the correct account paths", async () => {
    const paths = info.secretGetAccountPaths({ accountIdx: 0 });
    expect(paths).toMatchObject([{ addressNList: core.bip32ToAddressNList("m/44'/529'/0'/0/0") }]);
  });

  it("does not support getting the next account path", async () => {
    expect(untouchable.call(info, "secretNextAccountPath", {})).toBe(undefined);
  });
});

describe("NativeSecretWallet", () => {
  let wallet: native.NativeHDWallet;

  beforeEach(async () => {
    wallet = native.create({ deviceId: "native" });
    await wallet.loadDevice({ mnemonic: MNEMONIC });
    await expect(wallet.initialize()).resolves.toBe(true);
  });

  it("should generate a correct secret address", async () => {
    await expect(
      wallet.secretGetAddress({ addressNList: core.bip32ToAddressNList("m/44'/529'/0'/0/0") })
    ).resolves.toBe("secret189wrfk2fsynjlz6jcn54wzdcud3a6k8vqa0ggu");
  });

  it("should generate another correct secret address", async () => {
    await expect(
      wallet.secretGetAddress({ addressNList: core.bip32ToAddressNList("m/44'/529'/1337'/123/4") })
    ).resolves.toBe("secret1wmmewcjt2s09r48ya8mtdfyy0rnnza20xnx6fs");
  });

  it("should signing transactions", async () => {
    const signed = await wallet.secretSignTx({
      addressNList: core.bip32ToAddressNList("m/44'/529'/0'/0/0"),
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
      account_number: 123,
      sequence: 456,
    });
    expect(signed.signatures.length).toBe(1);
    expect(signed.signatures[0].pub_key.value).toMatchInlineSnapshot(`"A2UVKphVsesrnAQEtX4K+qk8Z84wa5xD5mxzdPykAiyR"`);
    expect(signed.signatures[0].signature).toMatchInlineSnapshot(
      `"f4HKv09XvsGQn74y4MHL+M+wP/uBjHsIn5PwPfq7xMI7CJkS22Pxx7KlXpeUzCjiaSZvEEIuxbkd9J+Q4g86jg=="`
    );
  });
});
