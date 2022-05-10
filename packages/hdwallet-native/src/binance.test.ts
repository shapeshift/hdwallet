import * as core from "@shapeshiftoss/hdwallet-core";
import * as bnbSdk from "bnb-javascript-sdk-nobroadcast";

import * as native from "./native";

const MNEMONIC = "all all all all all all all all all all all all";

const mswMock = require("mswMock")({
  get: {
    "https://dex.binance.org/api/v1/node-info": {
      node_info: {
        protocol_version: { p2p: 7, block: 10, app: 0 },
        id: "46ba46d5b6fcb61b7839881a75b081123297f7cf",
        listen_addr: "10.212.32.84:27146",
        network: "Binance-Chain-Tigris",
        version: "0.32.3",
        channels: "3640202122233038",
        moniker: "Ararat",
        other: { tx_index: "on", rpc_address: "tcp://0.0.0.0:27147" },
      },
      sync_info: {
        latest_block_hash: "307E98FD4A06AB02688C8539FF448431D521A3BB1C4D053DE3FBF1AD63276BA9",
        latest_app_hash: "A868C9E3186A4A8D562F73F3F53DB768F7F690478BF4D2C293A0F77F2E0C94DE",
        latest_block_height: 151030266,
        latest_block_time: "2021-03-18T20:42:11.972086064Z",
        catching_up: false,
      },
      validator_info: {
        address: "B7707D9F593C62E85BB9E1A2366D12A97CD5DFF2",
        pub_key: [
          113, 242, 215, 184, 236, 28, 139, 153, 166, 83, 66, 155, 1, 24, 205, 32, 31, 121, 79, 64, 157, 15, 234, 77,
          101, 177, 182, 98, 242, 176, 0, 99,
        ],
        voting_power: 1000000000000,
      },
    },
    "https://dex.binance.org/api/v1/account/bnb1qzc0v2q7u6484czzal6ncuvqmg9fae8n2xe2c6": {
      account_number: 123,
      address: "bnb1qzc0v2q7u6484czzal6ncuvqmg9fae8n2xe2c6",
      balances: [{ free: "0.00000000", frozen: "0.00000000", locked: "0.00000000", symbol: "BNB" }],
      flags: 0,
      public_key: null,
      sequence: 456,
    },
  },
}).startServer();
afterEach(() => expect(mswMock).not.toHaveBeenCalled());

const untouchable = require("untouchableMock");

describe("NativeBinanceWalletInfo", () => {
  const info = native.info();

  it("should return some static metadata", async () => {
    expect(await untouchable.call(info, "binanceSupportsNetwork")).toBe(true);
    expect(await untouchable.call(info, "binanceSupportsSecureTransfer")).toBe(false);
    expect(untouchable.call(info, "binanceSupportsNativeShapeShift")).toBe(false);
  });

  it("should return the correct account paths", async () => {
    const paths = info.binanceGetAccountPaths({ accountIdx: 0 });
    expect(paths).toMatchObject([
      {
        addressNList: core.bip32ToAddressNList("m/44'/714'/0'/0/0"),
      },
    ]);
  });

  it("does not support getting the next account path", async () => {
    expect(untouchable.call(info, "binanceNextAccountPath", {})).toBe(undefined);
  });
});

describe("NativeBinanceWallet", () => {
  let wallet: native.NativeHDWallet;

  beforeEach(async () => {
    wallet = native.create({ deviceId: "native" });
    await wallet.loadDevice({ mnemonic: MNEMONIC });
    expect(await wallet.initialize()).toBe(true);
  });

  it("should generate a correct binance address", async () => {
    expect(await wallet.binanceGetAddress({ addressNList: core.bip32ToAddressNList("m/44'/714'/0'/0/0") })).toBe(
      "bnb1qzc0v2q7u6484czzal6ncuvqmg9fae8n2xe2c6"
    );
  });

  it("should generate another correct binance address", async () => {
    expect(await wallet.binanceGetAddress({ addressNList: core.bip32ToAddressNList("m/44'/714'/1337'/123/4") })).toBe(
      "bnb14awl92k30hyhu36wjy6pg0trx3zlqrpfgsf3xk"
    );
  });

  it("should sign a transaction correctly", async () => {
    const sig = await wallet.binanceSignTx({
      addressNList: core.bip32ToAddressNList("m/44'/714'/0'/0/0"),
      tx: {
        chain_id: "foo",
        account_number: "123",
        data: null,
        memo: "memo",
        msgs: [
          {
            inputs: [
              {
                address: "bnb1qzc0v2q7u6484czzal6ncuvqmg9fae8n2xe2c6",
                coins: [{ amount: 1234, denom: "BNB" }],
              },
            ],
            outputs: [
              {
                address: "bnb14awl92k30hyhu36wjy6pg0trx3zlqrpfgsf3xk",
                coins: [{ amount: 1234, denom: "BNB" }],
              },
            ],
          },
        ],
        sequence: "456",
      },
    });
    expect(sig?.signatures).toMatchInlineSnapshot(`
      Object {
        "pub_key": "A/7/niWhEmyNrOL5jDyKiFyN1fMYjCxVPgyucVvj9UNT",
        "signature": "BnbtioXs2KyTQeJFpYQM6JmLgE4XOMLIDCCYw7z7wwpRMVwV0uVoeBoNh5zJrDcJzCQw8qmwzC+I5Cl/pTz+jg==",
      }
    `);
    expect(mswMock).toHaveBeenCalledWith("GET", "https://dex.binance.org/api/v1/node-info");
    mswMock.clear();
  });

  it("should sign a transaction correctly without being given an account number, sequence number, or chain id", async () => {
    const sig = await wallet.binanceSignTx({
      addressNList: core.bip32ToAddressNList("m/44'/714'/0'/0/0"),
      tx: {
        data: null,
        memo: "memo",
        msgs: [
          {
            inputs: [
              {
                address: "bnb1qzc0v2q7u6484czzal6ncuvqmg9fae8n2xe2c6",
                coins: [{ amount: 1234, denom: "BNB" }],
              },
            ],
            outputs: [
              {
                address: "bnb14awl92k30hyhu36wjy6pg0trx3zlqrpfgsf3xk",
                coins: [{ amount: 1234, denom: "BNB" }],
              },
            ],
          },
        ],
      },
    });
    expect(sig?.signatures).toMatchInlineSnapshot(`
      Object {
        "pub_key": "A/7/niWhEmyNrOL5jDyKiFyN1fMYjCxVPgyucVvj9UNT",
        "signature": "BnbtioXs2KyTQeJFpYQM6JmLgE4XOMLIDCCYw7z7wwpRMVwV0uVoeBoNh5zJrDcJzCQw8qmwzC+I5Cl/pTz+jg==",
      }
    `);
    expect(mswMock).toHaveBeenCalledWith("GET", "https://dex.binance.org/api/v1/node-info");
    expect(mswMock).toHaveBeenCalledWith(
      "GET",
      "https://dex.binance.org/api/v1/account/bnb1qzc0v2q7u6484czzal6ncuvqmg9fae8n2xe2c6"
    );
    mswMock.clear();
  });

  it("should only handle pubkeys returned from the BNB SDK if they are in amino format", async () => {
    expect.assertions(5);
    const original = bnbSdk.BncClient.prototype.transfer;
    const mock = jest
      .spyOn(bnbSdk.BncClient.prototype, "transfer")
      .mockImplementation(async function (this: any, ...args: any[]) {
        const out: any = await original.apply(this, args as any);
        out.signatures[0].pub_key = out.signatures[0].pub_key.slice(5);
        expect(out.signatures[0].pub_key.toString("base64")).toEqual("A/7/niWhEmyNrOL5jDyKiFyN1fMYjCxVPgyucVvj9UNT");
        return out;
      });
    await expect(
      wallet.binanceSignTx({
        addressNList: core.bip32ToAddressNList("m/44'/714'/0'/0/0"),
        tx: {
          chain_id: "foo",
          account_number: "123",
          data: "bar",
          memo: "memo",
          msgs: [
            {
              inputs: [
                {
                  address: "bnb1qzc0v2q7u6484czzal6ncuvqmg9fae8n2xe2c6",
                  coins: [{ amount: 1234, denom: "BNB" }],
                },
              ],
              outputs: [
                {
                  address: "bnb14awl92k30hyhu36wjy6pg0trx3zlqrpfgsf3xk",
                  coins: [{ amount: 1234, denom: "BNB" }],
                },
              ],
            },
          ],
          sequence: "456",
        },
      })
    ).rejects.toThrowError("Binance SDK returned public key in an incorrect format");
    mock.mockRestore();
    expect(mswMock).toHaveBeenCalledWith("GET", "https://dex.binance.org/api/v1/node-info");
    mswMock.clear();
  });

  it("should not sign an invalid transaction", async () => {
    await expect(
      wallet.binanceSignTx({
        addressNList: core.bip32ToAddressNList("m/44'/714'/0'/0/0"),
        tx: {
          chain_id: "",
          account_number: "",
          data: "",
          memo: "",
          msgs: [{}] as any,
          sequence: "NaN",
        },
      })
    ).rejects.toThrowError();
    expect(mswMock).toHaveBeenCalledWith("GET", "https://dex.binance.org/api/v1/node-info");
    mswMock.clear();
  });

  it("should not sign a transaction for a non-integer amount", async () => {
    await expect(
      wallet.binanceSignTx({
        addressNList: core.bip32ToAddressNList("m/44'/714'/0'/0/0"),
        tx: {
          chain_id: "foo",
          account_number: "123",
          data: "bar",
          memo: "memo",
          msgs: [
            {
              inputs: [
                {
                  address: "bnb1qzc0v2q7u6484czzal6ncuvqmg9fae8n2xe2c6",
                  coins: [{ amount: 123.4, denom: "BNB" }],
                },
              ],
              outputs: [
                {
                  address: "bnb14awl92k30hyhu36wjy6pg0trx3zlqrpfgsf3xk",
                  coins: [{ amount: 123.4, denom: "BNB" }],
                },
              ],
            },
          ],
          sequence: "456",
        },
      })
    ).rejects.toThrowError("amount must be an integer");
    expect(mswMock).toHaveBeenCalledWith("GET", "https://dex.binance.org/api/v1/node-info");
    mswMock.clear();
  });

  it("should not sign a transaction from a different account", async () => {
    await expect(
      wallet.binanceSignTx({
        addressNList: core.bip32ToAddressNList("m/44'/714'/0'/0/0"),
        tx: {
          chain_id: "foo",
          account_number: "123",
          data: "bar",
          memo: "memo",
          msgs: [
            {
              inputs: [
                {
                  address: "bnb14awl92k30hyhu36wjy6pg0trx3zlqrpfgsf3xk",
                  coins: [{ amount: 1234, denom: "BNB" }],
                },
              ],
              outputs: [
                {
                  address: "bnb1qzc0v2q7u6484czzal6ncuvqmg9fae8n2xe2c6",
                  coins: [{ amount: 1234, denom: "BNB" }],
                },
              ],
            },
          ],
          sequence: "456",
        },
      })
    ).rejects.toThrowError("Invalid permissions to sign for address");
    expect(mswMock).toHaveBeenCalledWith("GET", "https://dex.binance.org/api/v1/node-info");
    mswMock.clear();
  });
});
