import * as utils from "./utils";

describe("util", () => {
  describe("fromUtf8ToArray", () => {
    it("should convert a string to a Uint8Array", () => {
      const result = utils.fromUtf8ToArray("my_Fancy-P$ssw0rd");
      expect(result.constructor.name).toBe("Uint8Array");
      expect(result.length).toBe(17);
    });
  });

  describe("fromB64ToArray", () => {
    it("should convert a base64 string to an ArrayBuffer", () => {
      const array = new Uint8Array(32).fill(64);
      const base64 = Buffer.from(array).toString("base64");
      const result = utils.fromB64ToArray(base64);
      expect(result.constructor.name).toBe("Uint8Array");
      expect(result.length).toBe(32);
      expect(result).toEqual(array);
    });
  });

  describe("fromBufferToB64", () => {
    it("should convert an ArrayBuffer to a base64 string", () => {
      const array = new Uint8Array(32).fill(64);
      const result = utils.fromBufferToB64(array);
      expect(result).toEqual("QEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEA=");
    });
  });

  describe("fromBufferToUtf8", () => {
    it("should convert an ArrayBuffer to a string", () => {
      const array = new Uint8Array(16).fill(64);
      const result = utils.fromBufferToUtf8(array);
      expect(result).toEqual("@@@@@@@@@@@@@@@@");
    });
  });

  describe("toArrayBuffer", () => {
    it("should convert a string to ArrayBuffer", () => {
      const result = utils.toArrayBuffer("my_Fancy-P$ssw0rd");
      expect(result).toBeInstanceOf(ArrayBuffer);
      expect(result.byteLength).toBe(17);
    });

    it("should convert a Uint8Array to ArrayBuffer", () => {
      const result = utils.toArrayBuffer(new Uint8Array(32));
      expect(result).toBeInstanceOf(ArrayBuffer);
      expect(result.byteLength).toBe(32);
    });
  });
});
