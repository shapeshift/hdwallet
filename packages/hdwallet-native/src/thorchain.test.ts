import * as core from "@keepkey/hdwallet-core";

import * as native from "./native";

const MNEMONIC = "all all all all all all all all all all all all";

const mswMock = require("mswMock")().startServer();
afterEach(() => expect(mswMock).not.toHaveBeenCalled());

const untouchable = require("untouchableMock");

describe("NativeThorchainWalletInfo", () => {
  const info = native.info();

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
  let wallet: native.NativeHDWallet;

  beforeEach(async () => {
    wallet = native.create({ deviceId: "native" });
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
        msg: [
          {
            type: "thorchain/MsgSend",
            value: {
              from_address: "thor1ujumx36gj3jv33gcw49dfafdddza3kdcd38paq",
              to_address: "thor14hqwsy4qpwzsdk2l3h3q82eghg4ctaa38rx63g",
              amount: [
                {
                  denom: "rune",
                  amount: "123456",
                },
              ],
            },
          },
        ],
        fee: {
          amount: [],
          gas: "1000000",
        },
        memo: "hdwallet thorchain test",
        signatures: [],
      },
      chain_id: "thorchain-mainnet-v1",
      account_number: "2722",
      sequence: "11",
    });

    expect(signed?.signatures?.length).toBe(1);
    expect(signed?.signatures?.[0]).toBe(
      "hKgBg+lB6poFDTMIKPA/hBMkgrKb0BJ5aP1vy5KMze8/joV30TPZrayrLBK42/MDSCmVauNJbfwvRhrCQwRCmg=="
    );
  });
});
