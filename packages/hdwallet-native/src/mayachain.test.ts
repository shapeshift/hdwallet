import * as core from "@shapeshiftoss/hdwallet-core";

import * as native from "./native";

const MNEMONIC = "all all all all all all all all all all all all";

const mswMock = require("mswMock")().startServer();
afterEach(() => expect(mswMock).not.toHaveBeenCalled());

const untouchable = require("untouchableMock");

describe("NativeMayachainWalletInfo", () => {
  const info = native.info();

  it("should return some static metadata", async () => {
    await expect(untouchable.call(info, "mayachainSupportsNetwork")).resolves.toBe(true);
    await expect(untouchable.call(info, "mayachainSupportsSecureTransfer")).resolves.toBe(false);
    expect(untouchable.call(info, "mayachainSupportsNativeShapeShift")).toBe(false);
  });

  it("should return the correct account paths", async () => {
    const paths = info.mayachainGetAccountPaths({ accountIdx: 0 });
    expect(paths).toMatchObject([{ addressNList: core.bip32ToAddressNList("m/44'/931'/0'/0/0") }]);
  });

  it("does not support getting the next account path", async () => {
    expect(untouchable.call(info, "mayachainNextAccountPath", {})).toBe(undefined);
  });
});

describe("NativeThorchainWallet", () => {
  let wallet: native.NativeHDWallet;

  beforeEach(async () => {
    wallet = native.create({ deviceId: "native" });
    await wallet.loadDevice({ mnemonic: MNEMONIC });
    await expect(wallet.initialize()).resolves.toBe(true);
  });

  it("should generate a correct mayachain address", async () => {
    await expect(
      wallet.mayachainGetAddress({ addressNList: core.bip32ToAddressNList("m/44'/931'/0'/0/0") })
    ).resolves.toBe("maya1ujumx36gj3jv33gcw49dfafdddza3kdcdxedts");
  });

  it("should generate another correct mayachain address", async () => {
    await expect(
      wallet.mayachainGetAddress({ addressNList: core.bip32ToAddressNList("m/44'/931'/1337'/123/4") })
    ).resolves.toBe("maya14hqwsy4qpwzsdk2l3h3q82eghg4ctaa385ck8c");
  });

  it("should sign a transaction correctly", async () => {
    const signed = await wallet.mayachainSignTx({
      addressNList: core.bip32ToAddressNList("m/44'/931'/0'/0/0"),
      tx: {
        msg: [
          {
            type: "mayachain/MsgSend",
            value: {
              from_address: "maya1ujumx36gj3jv33gcw49dfafdddza3kdcdxedts",
              to_address: "maya14hqwsy4qpwzsdk2l3h3q82eghg4ctaa385ck8c",
              amount: [
                {
                  denom: "cacao",
                  amount: "12345678",
                },
              ],
            },
          },
        ],
        fee: {
          amount: [],
          gas: "1000000",
        },
        memo: "hdwallet mayachain test",
        signatures: [],
      },
      chain_id: "mayachain-mainnet-v1",
      account_number: "2722",
      sequence: "11",
    });

    expect(signed?.signatures?.length).toBe(1);
    expect(signed?.signatures?.[0]).toBe(
      "hKgBg+lB6poFDTMIKPA/hBMkgrKb0BJ5aP1vy5KMze8/joV30TPZrayrLBK42/MDSCmVauNJbfwvRhrCQwRCmg=="
    );
  });
});
