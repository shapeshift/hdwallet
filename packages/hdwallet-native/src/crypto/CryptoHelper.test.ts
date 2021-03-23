/**
 * @jest-environment jsdom
 */
import CryptoHelper from "./CryptoHelper";
import { WebCryptoEngine } from "./engines";
import { fromBufferToUtf8, toArrayBuffer } from "./utils";
import { Crypto } from "@peculiar/webcrypto";
import { CipherString } from "./classes";

const PLAINTEXT_STRING = "totally random secret data"
const ENCRYPTED_STRING = "2.A/tC/OC0U/KN3XuAuz2L36lydOyr5x367tPSGSrPkvQ=|AAAAAAAAAAAAAAAAAAAAAA==|ZqR8HTeOg4+8mzcty10jVFZ5MqFFbn5bwEaqlL0c/Mg="

describe("CryptoHelpers", () => {
  // Load shim to support running tests in node
  globalThis.crypto = new Crypto();
  const engine = new WebCryptoEngine();
  const helper = new CryptoHelper(engine);

  describe("constructor", () => {
    it("should require a CryptoEngine instances", () => {
      // @ts-ignore
      expect(() => new CryptoHelper()).toThrow("Missing cryptography engine");
    });

    it("should return a new instance", () => {
      expect(new CryptoHelper(engine)).toBeInstanceOf(CryptoHelper);
    });
  });

  describe("aesEncrypt", () => {
    it("should encrypt data with an hmac signature", async () => {
      const randomMock = jest
        .spyOn(global.crypto, "getRandomValues")
        .mockImplementation((array) => new Uint8Array(array.byteLength).fill(0));
      const key = await helper.makeKey("password", "email");
      const encrypted = await helper.aesEncrypt(toArrayBuffer(PLAINTEXT_STRING), key);
      randomMock.mockRestore();

      expect(encrypted.key).toEqual(key);
      expect(encrypted.iv.byteLength).toBe(16);
      expect(encrypted.mac.byteLength).toBe(32);
      expect(encrypted.data.byteLength).toBe(32);
      expect(encrypted.toString()).toEqual(ENCRYPTED_STRING);
    });

    it.each([[undefined], [null], ["encrypteddatastring"], [[1, 2, 3, 4, 5, 6]], [{}]])(
      "should throw an error if data is not an ArrayBuffer (%o)",
      async (param: any) => {
        await expect(helper.aesEncrypt(param, undefined)).rejects.toThrow("is not an ArrayBuffer");
      }
    );

    it.each([[undefined], [null], ["encrypteddatastring"], [[1, 2, 3, 4, 5, 6]], [{}]])(
      "should throw an error if key is not a SymmetricCryptoKey (%o)",
      async (param: any) => {
        await expect(helper.aesEncrypt(new Uint8Array(32), param)).rejects.toThrow("is not a SymmetricCryptoKey");
      }
    );

    it("should work with ArrayBuffers", async () => {
      const key = await helper.makeKey("password", "email");
      const encrypted = await helper.aesEncrypt(toArrayBuffer(PLAINTEXT_STRING), key);
      const decrypted = await helper.aesDecrypt(encrypted.data, encrypted.iv, encrypted.mac, key);
      expect(fromBufferToUtf8(decrypted)).toEqual(PLAINTEXT_STRING);
    });

    it("should work with Uint8Arrays", async () => {
      const key = await helper.makeKey("password", "email");
      const encrypted = await helper.aesEncrypt(new Uint8Array(toArrayBuffer(PLAINTEXT_STRING)), key);
      const decrypted = await helper.aesDecrypt(new Uint8Array(encrypted.data), new Uint8Array(encrypted.iv), new Uint8Array(encrypted.mac), key);
      expect(fromBufferToUtf8(decrypted)).toEqual(PLAINTEXT_STRING);
    });
  });

  describe("aesDecrypt", () => {
    it("should decrypt data with an hmac signature", async () => {
      const key = await helper.makeKey("password", "email");
      const encrypted = (new CipherString(ENCRYPTED_STRING)).toEncryptedObject(key);
      const decrypted = await helper.aesDecrypt(encrypted.data, encrypted.iv, encrypted.mac, encrypted.key);
      expect(fromBufferToUtf8(decrypted)).toEqual(PLAINTEXT_STRING);
    });

    it("should fail if the mac is incorrect", async () => {
      const key = await helper.makeKey("password", "email");
      const encrypted = (new CipherString(ENCRYPTED_STRING)).toEncryptedObject(key);
      const mac = new Uint8Array(encrypted.mac.byteLength).fill(128);
      await expect(helper.aesDecrypt(encrypted.data, encrypted.iv, mac, encrypted.key)).rejects.toThrow(
        "HMAC signature is not valid"
      );
    });

    it.each([[undefined], [null], ["encrypteddatastring"], [[1, 2, 3, 4, 5, 6]], [{}]])(
      "should throw an error if data is not an ArrayBuffer (%o)",
      async (param: any) => {
        await expect(helper.aesDecrypt(param, undefined, undefined, undefined)).rejects.toThrow("is not an ArrayBuffer");
      }
    );

    it.each([[undefined], [null], ["encrypteddatastring"], [[1, 2, 3, 4, 5, 6]], [{}]])(
      "should throw an error if iv is not an ArrayBuffer (%o)",
      async (param: any) => {
        const array = new Uint8Array(32).fill(0);
        await expect(helper.aesDecrypt(array, param, undefined, undefined)).rejects.toThrow("is not an ArrayBuffer");
      }
    );

    it.each([[undefined], [null], ["encrypteddatastring"], [[1, 2, 3, 4, 5, 6]], [{}]])(
      "should throw an error if mac is not an ArrayBuffer (%o)",
      async (param: any) => {
        const array = new Uint8Array(32).fill(0);
        await expect(helper.aesDecrypt(array, array, param, undefined)).rejects.toThrow("is not an ArrayBuffer");
      }
    );

    it.each([[undefined], [null], ["encrypteddatastring"], [[1, 2, 3, 4, 5, 6]], [{}]])(
      "should throw an error if key is not a SymmetricCryptoKey (%o)",
      async (param: any) => {
        const array = new Uint8Array(32).fill(0);
        await expect(helper.aesDecrypt(array, array, array, param)).rejects.toThrow("is not a SymmetricCryptoKey");
      }
    );
  });

  describe("compare", () => {
    it("should return false if arrays are different sizes", async () => {
      await expect(helper.compare(new Uint8Array(32), new Uint8Array(16))).resolves.toBe(false);
    });

    it("should return false if arrays are different", async () => {
      const mac1 = new Uint8Array(16).fill(0);
      const mac2 = new Uint8Array(16).fill(0);
      mac2.set([1], 15);
      await expect(helper.compare(mac1, mac2)).resolves.toBe(false);
    });
  });

  describe("makeKey", () => {
    it.each([[undefined], [null], [""], [[1, 2, 3, 4, 5, 6]], [{}]])(
      "should require a password (%o)",
      async (param: any) => {
        await expect(helper.makeKey(param, undefined)).rejects.toThrow("password");
      }
    );

    it.each([[undefined], [null], [""], [[1, 2, 3, 4, 5, 6]], [{}]])("should require an email (%o)", async (param: any) => {
      await expect(helper.makeKey("mypassword", param)).rejects.toThrow("email");
    });
  });

  describe("deviceId", () => {
    it("should return undefined if the wallet has not been initialized", async () => {
      await expect(
        helper.getDeviceId(
          "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
        )
      ).resolves.toBe("40bdrat83JXH1jC8EnGPujqEtorp/J/ToNeAOoyMLPs=");
    });

    it.each([[undefined], [null], [""], [[1, 2, 3, 4, 5, 6]], [{}]])(
      "should throw an error if invalid data is provided (%o)",
      async (data: any) => {
        await expect(helper.getDeviceId(data)).rejects.toThrow("Invalid data");
      }
    );
  });
});
