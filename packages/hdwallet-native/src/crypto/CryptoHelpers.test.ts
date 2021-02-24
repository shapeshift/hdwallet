/**
 * @jest-environment jsdom
 */
import CryptoHelper from "./CryptoHelper";
import { WebCryptoEngine } from "./engines";
import { fromBufferToUtf8, toArrayBuffer } from "./utils";
import { Crypto } from "@peculiar/webcrypto";

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
      const key = await helper.makeKey("password", "email");
      const encrypted = await helper.aesEncrypt(toArrayBuffer("totally random secret data"), key);
      expect(encrypted.key).toEqual(key);
      expect(encrypted.iv.byteLength).toBe(16);
      expect(encrypted.mac.byteLength).toBe(32);
      expect(encrypted.data.byteLength).toBe(32);
    });

    it.each([[undefined], [null], ["encrypteddatastring"], [[1, 2, 3, 4, 5, 6]], [{}]])(
      "should throw an error if data is not an ArrayBuffer (%o)",
      async (param) => {
        // @ts-ignore
        await expect(helper.aesEncrypt(param)).rejects.toThrow("is not an ArrayBuffer");
      }
    );

    it.each([[undefined], [null], ["encrypteddatastring"], [[1, 2, 3, 4, 5, 6]], [{}]])(
      "should throw an error if key is not a SymmetricCryptoKey (%o)",
      async (param) => {
        // @ts-ignore
        await expect(helper.aesEncrypt(new Uint8Array(32), param)).rejects.toThrow("is not a SymmetricCryptoKey");
      }
    );
  });

  describe("aesDecrypt", () => {
    it("should decrypt data with an hmac signature", async () => {
      const key = await helper.makeKey("password", "email");
      const encrypted = await helper.aesEncrypt(toArrayBuffer("totally random secret data"), key);
      const decrypted = await helper.aesDecrypt(encrypted.data, encrypted.iv, encrypted.mac, encrypted.key);
      expect(fromBufferToUtf8(decrypted)).toEqual("totally random secret data");
    });

    it("should should fail if the mac is incorrect", async () => {
      const key = await helper.makeKey("password", "email");
      const encrypted = await helper.aesEncrypt(toArrayBuffer("totally random secret data"), key);
      const mac = new Uint8Array(encrypted.mac.byteLength).fill(128);
      await expect(helper.aesDecrypt(encrypted.data, encrypted.iv, mac, encrypted.key)).rejects.toThrow(
        "HMAC signature is not valid"
      );
    });

    it.each([[undefined], [null], ["encrypteddatastring"], [[1, 2, 3, 4, 5, 6]], [{}]])(
      "should throw an error if data is not an ArrayBuffer (%o)",
      async (param) => {
        // @ts-ignore
        await expect(helper.aesDecrypt(param)).rejects.toThrow("is not an ArrayBuffer");
      }
    );

    it.each([[undefined], [null], ["encrypteddatastring"], [[1, 2, 3, 4, 5, 6]], [{}]])(
      "should throw an error if iv is not an ArrayBuffer (%o)",
      async (param) => {
        const array = new Uint8Array(32).fill(0);
        // @ts-ignore
        await expect(helper.aesDecrypt(array, param)).rejects.toThrow("is not an ArrayBuffer");
      }
    );

    it.each([[undefined], [null], ["encrypteddatastring"], [[1, 2, 3, 4, 5, 6]], [{}]])(
      "should throw an error if mac is not an ArrayBuffer (%o)",
      async (param) => {
        const array = new Uint8Array(32).fill(0);
        // @ts-ignore
        await expect(helper.aesDecrypt(array, array, param)).rejects.toThrow("is not an ArrayBuffer");
      }
    );

    it.each([[undefined], [null], ["encrypteddatastring"], [[1, 2, 3, 4, 5, 6]], [{}]])(
      "should throw an error if key is not a SymmetricCryptoKey (%o)",
      async (param) => {
        const array = new Uint8Array(32).fill(0);
        // @ts-ignore
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
      async (param) => {
        // @ts-ignore
        await expect(helper.makeKey(param)).rejects.toThrow("password");
      }
    );

    it.each([[undefined], [null], [""], [[1, 2, 3, 4, 5, 6]], [{}]])("should require an email (%o)", async (param) => {
      // @ts-ignore
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
