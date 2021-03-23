import * as core from "@shapeshiftoss/hdwallet-core";
import * as NativeHDWallet from "./native";

const MNEMONIC = "all all all all all all all all all all all all";

const mswMock = require("mswMock")().startServer();
afterEach(() => expect(mswMock).not.toHaveBeenCalled());

const untouchable = require("untouchableMock");

describe("NativeETHWalletInfo", () => {
  const info = NativeHDWallet.info();

  it("should return some static metadata", async () => {
    await expect(untouchable.call(info, "ethSupportsNetwork")).resolves.toBe(true);
    await expect(untouchable.call(info, "ethSupportsSecureTransfer")).resolves.toBe(false);
    expect(untouchable.call(info, "ethSupportsNativeShapeShift")).toBe(false);
  });

  it("should return the correct account paths", async () => {
    const paths = info.ethGetAccountPaths({ coin: "Ethereum", accountIdx: 0 });
    expect(paths).toMatchObject([
      {
        addressNList: core.bip32ToAddressNList("m/44'/60'/0'/0/0"),
        hardenedPath: core.bip32ToAddressNList("m/44'/60'/0'"),
        relPath: [0, 0],
        description: "Native",
      },
    ]);
  });

  it("does not support getting the next account path", async () => {
    expect(untouchable.call(info, "ethNextAccountPath", {})).toBe(undefined);
  });
});

describe("NativeETHWallet", () => {
  let wallet: NativeHDWallet.NativeHDWallet;

  beforeEach(async () => {
    wallet = NativeHDWallet.create({ deviceId: "native" });
    await wallet.loadDevice({ mnemonic: MNEMONIC });
    await expect(wallet.initialize()).resolves.toBe(true);
  });

  it("should generate a correct ethereum address", async () => {
    await expect(wallet.ethGetAddress({ addressNList: core.bip32ToAddressNList("m/44'/60'/0'/0/0") })).resolves.toBe(
      "0x73d0385F4d8E00C5e6504C6030F47BF6212736A8"
    );
  });

  // Reflection. Surprise. Terror. For the future.
  /*it("should generate another correct ethereum address", async () => {
    await expect(
      wallet.ethGetAddress({ addressNList: core.bip32ToAddressNList("m/44'/60'/1337'/123/4") })
    ).resolves.toBe("0x387F3031b30E2c8eB997E87a69FEA02756983b77");
  });*/

  it("fails when generating another ethereum address", async () => {
    await expect(
      wallet.ethGetAddress({ addressNList: core.bip32ToAddressNList("m/44'/60'/1337'/123/4") })
    ).rejects.toThrowError("path not supported");
  });

  it("should sign a transaction correctly", async () => {
    await expect(
      wallet.ethSignTx({
        addressNList: core.bip32ToAddressNList("m/44'/60'/0'/0/0"),
        nonce: "0xDEADBEEF",
        gasPrice: "0xDEADBEEF",
        gasLimit: "0xDEADBEEF",
        to: "0xDEADBEEFDEADBEEFDEADBEEFDEADBEEFDEADBEEF",
        value: "0xDEADBEEFDEADBEEFDEADBEEFDEADBEEF",
        data: "0xDEADBEEFDEADBEEFDEADBEEFDEADBEEF",
        chainId: 1,
      })
    ).resolves.toMatchInlineSnapshot(`
                  Object {
                    "r": "0xec482d7dfc3bfaf395b72dd1de692ab57c24134fb0bea39e986b16a4ad422d2f",
                    "s": "0x505506a0fb590d7ef63c24e9ae684eef608a6f48914d7cce762164d8c0a6fb29",
                    "serialized": "0xf88984deadbeef84deadbeef84deadbeef94deadbeefdeadbeefdeadbeefdeadbeefdeadbeef90deadbeefdeadbeefdeadbeefdeadbeef90deadbeefdeadbeefdeadbeefdeadbeef26a0ec482d7dfc3bfaf395b72dd1de692ab57c24134fb0bea39e986b16a4ad422d2fa0505506a0fb590d7ef63c24e9ae684eef608a6f48914d7cce762164d8c0a6fb29",
                    "v": 38,
                  }
              `);
  });

  it("should sign a message correctly", async () => {
    await expect(
      wallet.ethSignMessage({
        addressNList: core.bip32ToAddressNList("m/44'/60'/0'/0/0"),
        message: "super secret message",
      })
    ).resolves.toMatchInlineSnapshot(`
      Object {
        "address": "0x73d0385F4d8E00C5e6504C6030F47BF6212736A8",
        "signature": "0xd67ad52016d6fbc19fb9db81f32dd22cb67570b93b1c0e64ae30a4c2bc0b9c265c2d0f86906610d0cecac42ab90ee298a3474a5eb6d895aa7279d344f32aab191b",
      }
    `);
  });

  it("should verify a correctly signed message", async () => {
    await expect(
      wallet.ethVerifyMessage({
        address: "0x73d0385F4d8E00C5e6504C6030F47BF6212736A8",
        message: "super secret message",
        signature:
          "0xd67ad52016d6fbc19fb9db81f32dd22cb67570b93b1c0e64ae30a4c2bc0b9c265c2d0f86906610d0cecac42ab90ee298a3474a5eb6d895aa7279d344f32aab191b",
      })
    ).resolves.toBe(true);
  });

  it("should not verify if the message doesn't match", async () => {
    await expect(
      wallet.ethVerifyMessage({
        address: "0x73d0385F4d8E00C5e6504C6030F47BF6212736A8",
        message: "super public message",
        signature:
          "0xd67ad52016d6fbc19fb9db81f32dd22cb67570b93b1c0e64ae30a4c2bc0b9c265c2d0f86906610d0cecac42ab90ee298a3474a5eb6d895aa7279d344f32aab191b",
      })
    ).resolves.toBe(false);
  });

  it("should not verify if the signature is invalid", async () => {
    await expect(
      wallet.ethVerifyMessage({
        address: "0x73d0385F4d8E00C5e6504C6030F47BF6212736A8",
        message: "super secret message",
        signature:
          "deadbeef16d6fbc19fb9db81f32dd22cb67570b93b1c0e64ae30a4c2bc0b9c265c2d0f86906610d0cecac42ab90ee298a3474a5eb6d895aa7279d344f32aab191b",
      })
    ).resolves.toBe(false);
  });
});
