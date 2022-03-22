import * as core from "@shapeshiftoss/hdwallet-core";

import * as native from "./native";

const MNEMONIC = "all all all all all all all all all all all all";

const mswMock = require("mswMock")().startServer();
afterEach(() => expect(mswMock).not.toHaveBeenCalled());

const untouchable = require("untouchableMock");

describe("NativeKavaWalletInfo", () => {
  const info = native.info();

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
  let wallet: native.NativeHDWallet;

  beforeEach(async () => {
    wallet = native.create({ deviceId: "native" });
    await wallet.loadDevice({ mnemonic: MNEMONIC });
    await expect(wallet.initialize()).resolves.toBe(true);
  });

  it("should generate a correct kava address", async () => {
    await expect(wallet.kavaGetAddress({ addressNList: core.bip32ToAddressNList("m/44'/459'/0'/0/0") })).resolves.toBe(
      "kava1x9eec99f6m9d0nc3my4uyw55jefkcxj8dwxcpu"
    );
  });

  it("should generate another correct kava address", async () => {
    await expect(
      wallet.kavaGetAddress({ addressNList: core.bip32ToAddressNList("m/44'/459'/1337'/123/4") })
    ).resolves.toBe("kava1yhys0syftn2f624lue6fsxyql74r3evvljchjt");
  });

  it("should (probably) support signing transactions", async () => {
    // TODO: Replace with actual test data!
    const signed = await wallet.kavaSignTx({
      addressNList: core.bip32ToAddressNList("m/44'/459'/0'/0/0"),
      tx: {
        msg: [
          {
            type: "cosmos-sdk/MsgSend",
            value: {
              from_address: "kava1x9eec99f6m9d0nc3my4uyw55jefkcxj8dwxcpu",
              to_address: "kava1yhys0syftn2f624lue6fsxyql74r3evvljchjt",
              amount: [
                {
                  denom: "ukava",
                  amount: "100000",
                },
              ],
            },
          },
        ],
        fee: {
          amount: [
            {
              amount: "5000",
              denom: "ukava",
            },
          ],
          gas: "200000",
        },
        signatures: null,
        memo: "testmemo",
      },
      chain_id: "foobar",
      account_number: "123",
      sequence: "456",
    });
    await expect(signed?.signatures.length).toBe(1);
    await expect(signed?.signatures[0]).toMatchInlineSnapshot(
      `"X59d8usJrZTD8T9fVh/e+40DJ1+N6O4PzuSz2dIBNfcN3oB17ncj/KWWv29TwsO88DmFXy/dWvSTBJp29NWoqQ=="`
    );
  });
});
