/**
 * @jest-environment jsdom
 */
import CryptoHelper from "./CryptoHelper";
import WebCryptoEngine from "./engines/web-crypto";
import { toArrayBuffer } from "./utils";
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
  });

  describe("aesDecrypt", () => {});

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
});
