/**
 * @jest-environment jsdom
 */
import CryptoHelper from "./CryptoHelper";
import WebCryptoEngine from "./engines/web-crypto";
import { toArrayBuffer } from "./utils";
import { Crypto } from "@peculiar/webcrypto";

describe("CryptoHelpers", () => {
  // Load shim to support running tests in node
  global.crypto = new Crypto();
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
      const stretched = await helper.stretchKey(key);
      const encrypted = await helper.aesEncrypt(toArrayBuffer("totally random secret data"), stretched);
      expect(encrypted.key).toEqual(stretched);
      expect(encrypted.iv.byteLength).toBe(16);
      expect(encrypted.mac.byteLength).toBe(32);
      expect(encrypted.data.byteLength).toBe(32);
    });
  });

  describe("aesDecrypt", () => {});
});
