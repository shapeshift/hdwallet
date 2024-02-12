/**
 * @jest-environment jsdom
 */
import * as webcrypto from "@peculiar/webcrypto";
import * as core from "@shapeshiftoss/hdwallet-core";

import CryptoHelper from "../CryptoHelper";
import * as utils from "../utils";
import { DigestAlgorithm } from "./index";
import { WebCryptoEngine } from "./web-crypto";

describe("WebCryptoEngine JavaScript", () => {
  // Load shim to support running tests in node
  globalThis.crypto = new webcrypto.Crypto();

  const engine = new WebCryptoEngine();
  const helper = new CryptoHelper(engine);

  it("should decrypt what it encrypts", async () => {
    const data = core.toArrayBuffer(utils.fromUtf8ToArray("test all seed phrase words for to see this to work maybe"));
    const key = core.toArrayBuffer(utils.fromUtf8ToArray("12345678901234561234567890123456"));
    const iv = core.toArrayBuffer(utils.fromUtf8ToArray("1234567890123456"));

    const encrypted = await engine.encrypt(data, key, iv);

    const decrypted = utils.fromBufferToUtf8(await engine.decrypt(encrypted, key, iv));
    expect(decrypted).toEqual("test all seed phrase words for to see this to work maybe");
  });

  it("should decrypt what it encrypts with random key", async () => {
    const data = core.toArrayBuffer(utils.fromUtf8ToArray("test encrypted data"));
    const key = await engine.randomBytes(32);
    const iv = await engine.randomBytes(16);

    const encrypted = await engine.encrypt(data, key, iv);
    const decrypted = await engine.decrypt(encrypted, key, iv);
    expect(utils.fromBufferToUtf8(decrypted)).toEqual("test encrypted data");
  });

  it("should generate a key from a password and email", async () => {
    const key = await helper.makeKey("password", "email");
    expect(key.encKeyB64).toEqual("Ohkd7bfLczTp+zRe74f0raBkF3deLRWS4MvnIsYG7xQ=");
  });

  it("should generate a different key from a different password", async () => {
    const key = await helper.makeKey("password2", "email");
    expect(key.encKeyB64).not.toEqual("Ohkd7bfLczTp+zRe74f0raBkF3deLRWS4MvnIsYG7xQ=");
  });

  it("should generate a different key from a different email", async () => {
    const key = await helper.makeKey("password", "email2");
    expect(key.encKeyB64).not.toEqual("Ohkd7bfLczTp+zRe74f0raBkF3deLRWS4MvnIsYG7xQ=");
  });

  it("should generate a password hash from an encryption key and password", async () => {
    const key = await helper.makeKey("password", "email");
    expect(key.hashKeyB64).toEqual("W/7DR3sIqcb8lnLXD/ToTS+imBVMTyPR7JMend9hxrM=");
  });

  it("should generate a different password hash from an encryption key and password", async () => {
    const key = await helper.makeKey("password2", "email");
    const hash = await helper.pbkdf2(key.hashKey, "password2", 1);
    expect(utils.fromBufferToB64(hash)).not.toEqual("W/7DR3sIqcb8lnLXD/ToTS+imBVMTyPR7JMend9hxrM=");
  });

  it("should encrypt a wallet with a password and email", async () => {
    const key = await helper.makeKey("password", "email");

    const mnemonic = utils.fromUtf8ToArray("all all all all all all all all all all all all");
    const iv = utils.fromB64ToArray("rnvfQhmCO27xxEk33ayinw==");
    const encrypted = await engine.encrypt(mnemonic, key.encKey, iv);

    expect(utils.fromBufferToB64(encrypted)).toEqual(
      "FC2M6J3aqlavEne0Sl72Xyh3XB2RzxmNpy/zKNqu1ys+3Xe7pxyRQd+GRsLcf/Rf"
    );
  });

  it("should decrypt a wallet with a password and email", async () => {
    const key = await helper.makeKey("password", "email");
    const encryptedData = utils.fromB64ToArray("FC2M6J3aqlavEne0Sl72Xyh3XB2RzxmNpy/zKNqu1ys+3Xe7pxyRQd+GRsLcf/Rf");
    const iv = utils.fromB64ToArray("rnvfQhmCO27xxEk33ayinw==");
    const decrypted = await engine.decrypt(encryptedData, key.encKey, iv);

    expect(utils.fromBufferToUtf8(decrypted)).toEqual("all all all all all all all all all all all all");
  });

  it("should generate random bytes", async () => {
    const bytes = await engine.randomBytes(32);
    expect(bytes.byteLength).toBe(32);

    // Make sure we're not just returning an empty array of 0s
    // It's very unlikely that a random set of 32 bytes will result in all 0s
    const typedArray = new Uint8Array(bytes);
    const sum = typedArray.reduce((acc, value) => acc + value, 0);
    expect(sum).toBeGreaterThan(0);
  });

  it.each([
    [DigestAlgorithm.SHA256, "abc", "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"],
    [
      DigestAlgorithm.SHA256,
      "abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq",
      "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1",
    ],
    [
      DigestAlgorithm.SHA512,
      "abc",
      "ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f",
    ],
    [
      DigestAlgorithm.SHA512,
      "abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq",
      "204a8fc6dda82f0a0ced7beb8e08a41657c16ef468b228a8279be331a703c33596fd15c13b1b07f9aa1d3bea57789ca031ad85c7a71dd70354ec631238ca3445",
    ],
  ])("should produce a valid SHA hash (alg %s) for %s", async (alg, data: string, hash: string) => {
    const dataBuffer = utils.fromUtf8ToArray(data);
    const expected = core.toArrayBuffer(Buffer.from(hash, "hex"));
    const result = await engine.digest(alg, dataBuffer);
    expect(result).toEqual(expected);
  });
});

/*
To verify the web-crypto code is compatible with the mobile app,
the encrypted data used for these tests were generated by the mobile app

The following was added to `App/context/Wallet/index.tsx` in the `useEffect` hook
that initializes the wallet:

    // ============ REMOVE =================
    const key = await makeKey('password', 'email')
    console.log('key', key)
    const hash = await hashPassword('password', key)
    console.log('passwordHash', hash)
    const stretchedKey = await stretchKey(key)
    console.log('stretchedKey', stretchedKey)
    const encryptedWallet = await encrypt(
      'all all all all all all all all all all all all',
      stretchedKey
    )
    console.log('encryptedWallet', encryptedWallet)
    // ============ REMOVE =================

The result of that code was:

unstretched key
    {"encKey": {"data": [Array], "type": "Buffer"}, "encKeyB64": "Dh3RT7Uq4C5YVpsXBjCFnQZRnYiYEydLQPBgBLJ5MS8=", "encType": 0, "key": {"data": [Array], "type": "Buffer"}, "keyB64": "Dh3RT7Uq4C5YVpsXBjCFnQZRnYiYEydLQPBgBLJ5MS8=", "macKey": null, "macKeyB64": null}

passwordHash
    W/7DR3sIqcb8lnLXD/ToTS+imBVMTyPR7JMend9hxrM=

stretchedKey
    {"encKey": [], "encKeyB64": "Ohkd7bfLczTp+zRe74f0raBkF3deLRWS4MvnIsYG7xQ=", "encType": 2, "key": [], "keyB64": "Ohkd7bfLczTp+zRe74f0raBkF3deLRWS4MvnIsYG7xSisttHbNlnITu7dsitOKWy1L6ROQfr2tYZURsNXJcPbw==", "macKey": [], "macKeyB64": "orLbR2zZZyE7u3bIrTilstS+kTkH69rWGVEbDVyXD28="}

encryptedWallet
    {"data": "FC2M6J3aqlavEne0Sl72Xyh3XB2RzxmNpy/zKNqu1ys+3Xe7pxyRQd+GRsLcf/Rf", "encryptedString": "2.FC2M6J3aqlavEne0Sl72Xyh3XB2RzxmNpy/zKNqu1ys+3Xe7pxyRQd+GRsLcf/Rf|rnvfQhmCO27xxEk33ayinw==|kvwPLZpJtrTuob3xNVxSiePJ+newC7keI1DPGyUls/Y=", "encryptionType": 2, "iv": "rnvfQhmCO27xxEk33ayinw==", "mac": "kvwPLZpJtrTuob3xNVxSiePJ+newC7keI1DPGyUls/Y="}
 */
