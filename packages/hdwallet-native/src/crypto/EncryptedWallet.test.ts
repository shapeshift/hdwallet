/**
 * @jest-environment jsdom
 */
import * as webcrypto from "@peculiar/webcrypto";

import { EncryptedWallet } from "./EncryptedWallet";
import { WebCryptoEngine } from "./engines";

const PLAINTEXT_MNEMONIC = "boat garment fog other pony middle bronze ready grain betray load frame";
const ENCRYPTED_MNEMONIC =
  "2.Q1/C6FLg1MufcTAmEXEmQbuyPdjuXEGw3AP17sWhJ3Ws8Fcsl03XUDlC3zULVHY4+IU4lMtyjfnRNKlCF4Sy9OeUvS//i7JUCS6ieLAn5U8=|AAAAAAAAAAAAAAAAAAAAAA==|nuOb9GoiRhAkWRLLRqqDna05Jp03Botr3JF8A34SS3U=";

const PLAINTEXT_MNEMONIC2 =
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
const ENCRYPTED_MNEMONIC2 =
  "2.1gm0swmYoZCc/T/U1aSGTsp0NgSQFtNT/N8U4nAgTWeJ28xpjlrGAjZwezW4vrwR8+TprSfaNCsh9lv1Nr19+/R3Ya2kj9obHhZZz1FL6qVY1dOdqfoaEWiqui54zlCb|AAAAAAAAAAAAAAAAAAAAAA==|R5969JYt8Y5CH55TFsafDVl8CXx8tv2ii2wjOMurdf4=";

const ENCRYPTED_EMPTY_STRING =
  "2.7wpUO5ISHHdT1voBnjzyXQ==|AAAAAAAAAAAAAAAAAAAAAA==|02KQ8aQWWXUX7foOmf4T2W0XCFAk4OTKFQO+hRhlRcY=";

describe("EncryptedWallet", () => {
  // Load shim to support running tests in node
  globalThis.crypto = new webcrypto.Crypto();
  const engine = new WebCryptoEngine();

  describe("constructor", () => {
    it("should be instantiated", () => {
      expect(new EncryptedWallet(engine)).toBeInstanceOf(EncryptedWallet);
    });

    it("should require a crypto engine", () => {
      expect(
        () => new EncryptedWallet(undefined as unknown as ConstructorParameters<typeof EncryptedWallet>[0])
      ).toThrow("Missing");
    });
  });

  describe("init", () => {
    it("should generate a password hash and encrypted mnemonic from a given email and password", async () => {
      const wallet = new EncryptedWallet(engine);
      const result = await wallet.init("email", "password");

      expect(result.email).toEqual("email");
      expect(result.passwordHash).toEqual("W/7DR3sIqcb8lnLXD/ToTS+imBVMTyPR7JMend9hxrM=");
      expect(result.encryptedWallet).toBeUndefined();
    });

    it.each([[], [null], [[1, 2, 3]], ""])(
      "should not generate a password hash and encrypted mnemonic if no password is provided (%p)",
      async (pw) => {
        const wallet = new EncryptedWallet(engine);
        await expect(wallet.init("email", pw as string)).rejects.toThrow("Invalid password");
      }
    );

    it.each([[], [null], [[1, 2, 3]], ""])(
      "should not generate a password hash and encrypted mnemonic if no email is provided (%p)",
      async (email) => {
        const wallet = new EncryptedWallet(engine);
        await expect(wallet.init(email as string, "password")).rejects.toThrow("Invalid email");
      }
    );
  });

  describe("encryptedWallet", () => {
    it("should allow settings the encrypted wallet string", async () => {
      const wallet = new EncryptedWallet(engine);
      await wallet.init("email", "password");
      wallet.encryptedWallet = ENCRYPTED_MNEMONIC;
      expect(wallet.encryptedWallet).toEqual(ENCRYPTED_MNEMONIC);
    });

    it("should throw an error", async () => {
      const wallet = new EncryptedWallet(engine);
      await wallet.init("email", "password");
      expect(() => (wallet.encryptedWallet = "")).toThrow("Invalid");
    });
  });

  describe("createWallet", () => {
    it("should hash password on construction", async () => {
      const wallet = new EncryptedWallet(engine);
      await wallet.init("email", "password");

      expect(wallet.email).toEqual("email");
      expect(wallet.passwordHash).toEqual("W/7DR3sIqcb8lnLXD/ToTS+imBVMTyPR7JMend9hxrM=");
    });

    it("should create a new encrypted wallet", async () => {
      const randomMock = jest
        .spyOn(global.crypto, "getRandomValues")
        .mockImplementation((array) => array && new Uint8Array(array.byteLength).fill(0));
      const wallet = new EncryptedWallet(engine);
      await wallet.init("email", "password");
      await wallet.createWallet(PLAINTEXT_MNEMONIC2);
      randomMock.mockRestore();

      expect(wallet.encryptedWallet).toEqual(ENCRYPTED_MNEMONIC2);
    });

    it("should throw an error if the mnemonic is invalid", async () => {
      const randomMock = jest.spyOn(require("bip39"), "validateMnemonic").mockReturnValue(false);
      const wallet = new EncryptedWallet(engine);
      const result = await wallet.init("email", "password");
      await expect(result.createWallet()).rejects.toThrow("Invalid mnemonic");
      randomMock.mockRestore();
    });

    it("should require the wallet to be initialized", async () => {
      const wallet = new EncryptedWallet(engine);
      await expect(wallet.createWallet()).rejects.toThrow("not initialized");
    });
  });

  describe("decrypt", () => {
    it.each([
      [PLAINTEXT_MNEMONIC, ENCRYPTED_MNEMONIC],
      [PLAINTEXT_MNEMONIC2, ENCRYPTED_MNEMONIC2],
    ])("should decrypt a wallet with seed (%s)", async (PLAIN, ENCRYPTED) => {
      const wallet = new EncryptedWallet(engine);
      const result = await wallet.init("email", "password", ENCRYPTED);

      expect(await result.decrypt()).toEqual(PLAIN);
    });

    it("should require the wallet to be initialized", async () => {
      const wallet = new EncryptedWallet(engine);
      await expect(wallet.decrypt()).rejects.toThrow("not initialized");
    });

    it("should require that the wallet has an encrypted wallet", async () => {
      const wallet = new EncryptedWallet(engine);
      await wallet.init("email", "password");
      await expect(wallet.decrypt()).rejects.toThrow("does not contain an encrypted wallet");
    });

    it("should throw an error if the wallet cannot decrypt the wallet", async () => {
      const wallet = new EncryptedWallet(engine);
      await wallet.init("email", "password2", ENCRYPTED_MNEMONIC);
      await expect(wallet.decrypt()).rejects.toThrow("signature is not valid");
    });

    it("should throw an error if the decrypted mnemonic is the empty string", async () => {
      const wallet = new EncryptedWallet(engine);
      await wallet.init("email", "password", ENCRYPTED_EMPTY_STRING);
      await expect(wallet.decrypt()).rejects.toThrow("Decryption failed");
    });
  });

  describe("deviceId", () => {
    it("should return undefined if the wallet has not been initialized", async () => {
      const wallet = new EncryptedWallet(engine);
      expect(wallet.deviceId).toBeUndefined();
    });

    it("should return undefined if the wallet has not been decrypted", async () => {
      const wallet = new EncryptedWallet(engine);
      await wallet.init("email", "password", ENCRYPTED_MNEMONIC);
      expect(wallet.deviceId).toBeUndefined();
    });

    it("should return a base64 hash", async () => {
      const wallet = new EncryptedWallet(engine);
      await wallet.init("email", "password", ENCRYPTED_MNEMONIC);
      await wallet.decrypt();
      expect(wallet.deviceId).toBe("0SUnRnGkhCt0T5qk5YmK10v5u+lgHiMMu1R76uD7kHE=");
    });
  });

  describe("reset", () => {
    it("should remove all private data from the object", async () => {
      const wallet = new EncryptedWallet(engine);
      const result = await wallet.init("email", "password", ENCRYPTED_MNEMONIC);
      result.reset();
      expect(result.encryptedWallet).toBeUndefined();
      expect(result.email).toBeUndefined();
      expect(result.passwordHash).toBeUndefined();
    });
  });
});
