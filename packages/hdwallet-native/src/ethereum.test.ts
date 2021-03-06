import { splitSignature } from "@shapeshiftoss/ethers-bytes";
import { keccak256 } from "@shapeshiftoss/ethers-keccak256";
import { recoverPublicKey } from "@shapeshiftoss/ethers-signing-key";
import { computeAddress, parse as parseTransaction } from "@shapeshiftoss/ethers-transactions";
import * as core from "@shapeshiftoss/hdwallet-core";
import { TextEncoder } from "web-encoding";

import * as native from "./native";

const MNEMONIC = "all all all all all all all all all all all all";

const mswMock = require("mswMock")().startServer();
afterEach(() => expect(mswMock).not.toHaveBeenCalled());

const untouchable = require("untouchableMock");

describe("NativeETHWalletInfo", () => {
  const info = native.info();

  it("should return some static metadata", async () => {
    expect(await untouchable.call(info, "ethSupportsNetwork")).toBe(true);
    expect(await untouchable.call(info, "ethSupportsSecureTransfer")).toBe(false);
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
  let wallet: native.NativeHDWallet;

  beforeEach(async () => {
    wallet = native.create({ deviceId: "native" });
    await wallet.loadDevice({ mnemonic: MNEMONIC });
    expect(await wallet.initialize()).toBe(true);
  });

  it("should generate a correct ethereum address", async () => {
    expect(await wallet.ethGetAddress({ addressNList: core.bip32ToAddressNList("m/44'/60'/0'/0/0") })).toBe(
      "0x73d0385F4d8E00C5e6504C6030F47BF6212736A8"
    );
  });

  // Reflection. Surprise. Terror. For the future.
  /*it("should generate another correct ethereum address", async () => {
    expect(
      await wallet.ethGetAddress({ addressNList: core.bip32ToAddressNList("m/44'/60'/1337'/123/4") })
    ).toBe("0x387F3031b30E2c8eB997E87a69FEA02756983b77");
  });*/

  it("fails when generating another ethereum address", async () => {
    await expect(
      wallet.ethGetAddress({ addressNList: core.bip32ToAddressNList("m/44'/60'/1337'/123/4") })
    ).rejects.toThrowError("path not supported");
  });

  it("should sign a transaction correctly", async () => {
    const sig = await wallet.ethSignTx({
      addressNList: core.bip32ToAddressNList("m/44'/60'/0'/0/0"),
      nonce: "0xDEADBEEF",
      gasPrice: "0xDEADBEEF",
      gasLimit: "0xDEADBEEF",
      to: "0xDEADBEEFDEADBEEFDEADBEEFDEADBEEFDEADBEEF",
      value: "0xDEADBEEFDEADBEEFDEADBEEFDEADBEEF",
      data: "0xDEADBEEFDEADBEEFDEADBEEFDEADBEEF",
      chainId: 1,
    });
    // This is the output from tiny-secp256k1.
    expect(sig).toMatchInlineSnapshot(`
      Object {
        "r": "0x7f21bb5a857db55c888355b2e48325062268ad62686fba56a4e57118f5783dda",
        "s": "0x3e9893ed500842506a19288eb022b5f5b3cee6d1bbf6330f4304f60f8166f82a",
        "serialized": "0xf88984deadbeef84deadbeef84deadbeef94deadbeefdeadbeefdeadbeefdeadbeefdeadbeef90deadbeefdeadbeefdeadbeefdeadbeef90deadbeefdeadbeefdeadbeefdeadbeef26a07f21bb5a857db55c888355b2e48325062268ad62686fba56a4e57118f5783ddaa03e9893ed500842506a19288eb022b5f5b3cee6d1bbf6330f4304f60f8166f82a",
        "v": 38,
      }
    `);
    // This is the output of the native library's own signing function.
    /*expect(sig).toMatchInlineSnapshot(`
      Object {
        "r": "0xec482d7dfc3bfaf395b72dd1de692ab57c24134fb0bea39e986b16a4ad422d2f",
        "s": "0x505506a0fb590d7ef63c24e9ae684eef608a6f48914d7cce762164d8c0a6fb29",
        "serialized": "0xf88984deadbeef84deadbeef84deadbeef94deadbeefdeadbeefdeadbeefdeadbeefdeadbeef90deadbeefdeadbeefdeadbeefdeadbeef90deadbeefdeadbeefdeadbeefdeadbeef26a0ec482d7dfc3bfaf395b72dd1de692ab57c24134fb0bea39e986b16a4ad422d2fa0505506a0fb590d7ef63c24e9ae684eef608a6f48914d7cce762164d8c0a6fb29",
        "v": 38,
      }
    `);*/
    expect(parseTransaction(sig!.serialized).from).toEqual("0x73d0385F4d8E00C5e6504C6030F47BF6212736A8");
  });

  it("should sign a message correctly", async () => {
    const msg = "super secret message";
    const sig = await wallet.ethSignMessage({
      addressNList: core.bip32ToAddressNList("m/44'/60'/0'/0/0"),
      message: msg,
    });
    // This is the output from tiny-secp256k1.
    expect(sig).toMatchInlineSnapshot(`
      Object {
        "address": "0x73d0385F4d8E00C5e6504C6030F47BF6212736A8",
        "signature": "0x05f51140905ffa33ffdc57f46b0b8d8fbb1d2a99f8cd843ca27893c01c31351c08b76d83dce412731c846e3b50649724415deb522d00950fbf4f2c1459c2b70b1b",
      }
    `);
    // This is the output of the native library's own signing function.
    /*expect(sig).toMatchInlineSnapshot(`
      Object {
        "address": "0x73d0385F4d8E00C5e6504C6030F47BF6212736A8",
        "signature": "0xd67ad52016d6fbc19fb9db81f32dd22cb67570b93b1c0e64ae30a4c2bc0b9c265c2d0f86906610d0cecac42ab90ee298a3474a5eb6d895aa7279d344f32aab191b",
      }
    `);*/
    expect(
      computeAddress(
        recoverPublicKey(
          keccak256(new TextEncoder().encode(`\x19Ethereum Signed Message:\n${msg.length}${msg}`)),
          splitSignature(sig!.signature)
        )
      )
    ).toEqual(sig!.address);
  });

  it("should verify a correctly signed message", async () => {
    expect(
      await wallet.ethVerifyMessage({
        address: "0x73d0385F4d8E00C5e6504C6030F47BF6212736A8",
        message: "super secret message",
        signature:
          "0xd67ad52016d6fbc19fb9db81f32dd22cb67570b93b1c0e64ae30a4c2bc0b9c265c2d0f86906610d0cecac42ab90ee298a3474a5eb6d895aa7279d344f32aab191b",
      })
    ).toBe(true);
  });

  it("should verify a differently, but still correctly, signed message", async () => {
    expect(
      await wallet.ethVerifyMessage({
        address: "0x73d0385F4d8E00C5e6504C6030F47BF6212736A8",
        message: "super secret message",
        signature:
          "0x72d4baca0c1ca0eea587decb0177ded99fb50f62c4bd24d8595000d70e6383833eb0700fb6c96086154c2607b735ee1047ed4060211b32a52b43d827615b3e691c",
      })
    ).toBe(true);
  });

  it("should not verify if the message doesn't match", async () => {
    expect(
      await wallet.ethVerifyMessage({
        address: "0x73d0385F4d8E00C5e6504C6030F47BF6212736A8",
        message: "super public message",
        signature:
          "0xd67ad52016d6fbc19fb9db81f32dd22cb67570b93b1c0e64ae30a4c2bc0b9c265c2d0f86906610d0cecac42ab90ee298a3474a5eb6d895aa7279d344f32aab191b",
      })
    ).toBe(false);
  });

  it("should not verify if the signature is invalid", async () => {
    expect(
      await wallet.ethVerifyMessage({
        address: "0x73d0385F4d8E00C5e6504C6030F47BF6212736A8",
        message: "super secret message",
        signature:
          "deadbeef16d6fbc19fb9db81f32dd22cb67570b93b1c0e64ae30a4c2bc0b9c265c2d0f86906610d0cecac42ab90ee298a3474a5eb6d895aa7279d344f32aab191b",
      })
    ).toBe(false);
  });
});
