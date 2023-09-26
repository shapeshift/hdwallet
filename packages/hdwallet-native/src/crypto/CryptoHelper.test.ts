/**
 * @jest-environment jsdom
 */
import * as webcrypto from "@peculiar/webcrypto";
import * as core from "@shapeshiftoss/hdwallet-core";

import { CipherString } from "./classes";
import CryptoHelper from "./CryptoHelper";
import { WebCryptoEngine } from "./engines";
import * as utils from "./utils";

const PLAINTEXT_STRING = "totally random secret data";
const ENCRYPTED_STRING =
  "2.A/tC/OC0U/KN3XuAuz2L36lydOyr5x367tPSGSrPkvQ=|AAAAAAAAAAAAAAAAAAAAAA==|ZqR8HTeOg4+8mzcty10jVFZ5MqFFbn5bwEaqlL0c/Mg=";
const ENCRYPTED_EMPTY_STRING =
  "2.7wpUO5ISHHdT1voBnjzyXQ==|AAAAAAAAAAAAAAAAAAAAAA==|02KQ8aQWWXUX7foOmf4T2W0XCFAk4OTKFQO+hRhlRcY=";

const BAD_ARGS = [undefined, null, "encrypteddatastring", [1, 2, 3, 4, 5, 6], {}];

describe("CryptoHelpers", () => {
  // Load shim to support running tests in node
  globalThis.crypto = new webcrypto.Crypto();
  const engine = new WebCryptoEngine();
  const helper = new CryptoHelper(engine);

  describe("constructor", () => {
    it("should require a CryptoEngine instances", () => {
      expect(() => new CryptoHelper(undefined as any)).toThrow("Missing cryptography engine");
    });

    it("should return a new instance", () => {
      expect(new CryptoHelper(engine)).toBeInstanceOf(CryptoHelper);
    });
  });

  describe("aesEncrypt", () => {
    it("should encrypt data with an hmac signature", async () => {
      const randomMock = jest
        .spyOn(global.crypto, "getRandomValues")
        .mockImplementation((array) => array && new Uint8Array(array.byteLength).fill(0));
      const key = await helper.makeKey("password", "email");
      const encrypted = await helper.aesEncrypt(utils.fromUtf8ToArray(PLAINTEXT_STRING), key);
      randomMock.mockRestore();

      expect(encrypted.key).toEqual(key);
      expect(encrypted.iv.byteLength).toBe(16);
      expect(encrypted.mac.byteLength).toBe(32);
      expect(encrypted.data.byteLength).toBe(32);
      expect(encrypted.toString()).toEqual(ENCRYPTED_STRING);
    });

    it("should encrypt the empty string", async () => {
      const randomMock = jest
        .spyOn(global.crypto, "getRandomValues")
        .mockImplementation((array) => array && new Uint8Array(array.byteLength).fill(0));
      const key = await helper.makeKey("password", "email");
      const encrypted = await helper.aesEncrypt(utils.fromUtf8ToArray(""), key);
      randomMock.mockRestore();

      expect(encrypted.key).toEqual(key);
      expect(encrypted.iv.byteLength).toBe(16);
      expect(encrypted.mac.byteLength).toBe(32);
      expect(encrypted.data.byteLength).toBe(16);
      expect(encrypted.toString()).toEqual(ENCRYPTED_EMPTY_STRING);
    });

    it.each([
      ["data", 0],
      ["key", 1],
    ])("should throw an error if %s is not the correct type", async (name, position) => {
      const dummyArg = new Uint8Array(32).fill(0);
      for (const arg of BAD_ARGS) {
        const args = new Array(position).fill(dummyArg);
        args.push(arg);
        await expect((helper.aesEncrypt as any)(...(args as any))).rejects.toThrowError(`[${name}] is not of type`);
      }
    });

    it("should work with ArrayBuffers", async () => {
      const key = await helper.makeKey("password", "email");
      const encrypted = await helper.aesEncrypt(core.toArrayBuffer(utils.fromUtf8ToArray(PLAINTEXT_STRING)), key);
      const decrypted = await helper.aesDecrypt(encrypted.data, encrypted.iv, encrypted.mac, key);
      expect(utils.fromBufferToUtf8(decrypted)).toEqual(PLAINTEXT_STRING);
    });

    it("should work with Uint8Arrays", async () => {
      const key = await helper.makeKey("password", "email");
      const encrypted = await helper.aesEncrypt(utils.fromUtf8ToArray(PLAINTEXT_STRING), key);
      const decrypted = await helper.aesDecrypt(
        new Uint8Array(encrypted.data),
        new Uint8Array(encrypted.iv),
        new Uint8Array(encrypted.mac),
        key
      );
      expect(utils.fromBufferToUtf8(decrypted)).toEqual(PLAINTEXT_STRING);
    });
  });

  describe("aesDecrypt", () => {
    it("should decrypt data with an hmac signature", async () => {
      const key = await helper.makeKey("password", "email");
      const encrypted = new CipherString(ENCRYPTED_STRING).toEncryptedObject(key);
      const decrypted = await helper.aesDecrypt(encrypted.data, encrypted.iv, encrypted.mac, encrypted.key);
      expect(utils.fromBufferToUtf8(decrypted)).toEqual(PLAINTEXT_STRING);
    });

    it("should fail if the data is incorrect", async () => {
      const key = await helper.makeKey("password", "email");
      const encrypted = new CipherString(ENCRYPTED_STRING).toEncryptedObject(key);
      const data = new Uint8Array(encrypted.data.byteLength).fill(0x80);
      await expect(helper.aesDecrypt(data, encrypted.iv, encrypted.mac, encrypted.key)).rejects.toThrow(
        "HMAC signature is not valid"
      );
    });

    it("should fail if the iv is incorrect", async () => {
      const key = await helper.makeKey("password", "email");
      const encrypted = new CipherString(ENCRYPTED_STRING).toEncryptedObject(key);
      const iv = new Uint8Array(encrypted.iv.byteLength).fill(0x80);
      await expect(helper.aesDecrypt(encrypted.data, iv, encrypted.mac, encrypted.key)).rejects.toThrow(
        "HMAC signature is not valid"
      );
    });

    it("should fail if the mac is incorrect", async () => {
      const key = await helper.makeKey("password", "email");
      const encrypted = new CipherString(ENCRYPTED_STRING).toEncryptedObject(key);
      const mac = new Uint8Array(encrypted.mac.byteLength).fill(0x80);
      await expect(helper.aesDecrypt(encrypted.data, encrypted.iv, mac, encrypted.key)).rejects.toThrow(
        "HMAC signature is not valid"
      );
    });

    it("should fail if the key is incorrect", async () => {
      const key = await helper.makeKey("password2", "email");
      const encrypted = new CipherString(ENCRYPTED_STRING).toEncryptedObject(key);
      await expect(helper.aesDecrypt(encrypted.data, encrypted.iv, encrypted.mac, encrypted.key)).rejects.toThrow(
        "HMAC signature is not valid"
      );
    });

    it.each([
      ["data", 0],
      ["iv", 1],
      ["mac", 2],
      ["key", 3],
    ])("should throw an error if %s is not the correct type", async (name, position) => {
      const dummyArg = new Uint8Array(32).fill(0);
      for (const value of BAD_ARGS) {
        const args = new Array(position).fill(dummyArg);
        args.push(value);
        await expect((helper.aesDecrypt as any)(...(args as any))).rejects.toThrowError(`[${name}] is not of type`);
      }
    });
  });

  describe("compare", () => {
    it("should return false if arrays are different sizes", async () => {
      expect(await helper.compare(new Uint8Array(32), new Uint8Array(16))).toBe(false);
    });

    it("should return false if the hmac results are different sizes", async () => {
      let i = 0;
      const mock = jest.spyOn(engine, "hmac").mockImplementation(async () => {
        return core.toArrayBuffer(new Uint8Array(++i * 16));
      });
      const result = await helper.compare(new Uint8Array(32), new Uint8Array(32));
      mock.mockRestore();
      await expect(result).toBe(false);
    });

    it("should return false if arrays are different", async () => {
      const mac1 = new Uint8Array(16).fill(0);
      const mac2 = new Uint8Array(16).fill(0);
      mac2.set([1], 15);
      expect(await helper.compare(mac1, mac2)).toBe(false);
    });
  });

  describe("makeKey", () => {
    it.each([[undefined], [null], [""], [[1, 2, 3, 4, 5, 6]], [{}]])(
      "should require a password (%o)",
      async (param: any) => {
        await expect(helper.makeKey(param, undefined as any)).rejects.toThrow("password");
      }
    );

    it.each([[undefined], [null], [""], [[1, 2, 3, 4, 5, 6]], [{}]])(
      "should require an email (%o)",
      async (param: any) => {
        await expect(helper.makeKey("mypassword", param)).rejects.toThrow("email");
      }
    );
  });

  describe("deviceId", () => {
    it("should return undefined if the wallet has not been initialized", async () => {
      expect(
        await helper.getDeviceId(
          "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
        )
      ).toBe("40bdrat83JXH1jC8EnGPujqEtorp/J/ToNeAOoyMLPs=");
    });

    it.each([[undefined], [null], [""], [[1, 2, 3, 4, 5, 6]], [{}]])(
      "should throw an error if invalid data is provided (%o)",
      async (data: any) => {
        await expect(helper.getDeviceId(data)).rejects.toThrow("Invalid data");
      }
    );
  });
});
