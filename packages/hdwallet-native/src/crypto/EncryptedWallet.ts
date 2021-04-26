import * as core from "@shapeshiftoss/hdwallet-core";
import * as bip39 from "bip39";

import CryptoHelper from "./CryptoHelper";
import { CryptoEngine } from "./engines";
import { CipherString, SymmetricCryptoKey } from "./classes";
import * as utils from "./utils";

export class EncryptedWallet {
  readonly #engine: CryptoEngine;
  readonly #helper: CryptoHelper;
  #deviceId: string;
  #email: string;
  #encryptedWallet: string;
  #key: SymmetricCryptoKey;
  #password: string;

  constructor(engine: CryptoEngine) {
    if (!engine) {
      throw new Error("Missing cryptography engine");
    }
    this.#engine = engine;
    this.#helper = new CryptoHelper(this.#engine);
  }

  /**
   * Whether or not the wallet has been initialized with an email and password
   */
  get isInitialized() {
    return Boolean(this.#email && this.#password && this.#key);
  }

  /**
   * The email provided to the `init` function
   */
  get email() {
    return this.#email;
  }

  /**
   * A hash derived from the email and password to be used for authentication
   */
  get passwordHash() {
    return this.#key?.hashKeyB64;
  }

  /**
   * A string representation of the encrypted seed phrase
   */
  get encryptedWallet() {
    return this.#encryptedWallet;
  }

  /**
   * Get an ID based on the mnemonic
   * Calling `decrypt` will set this value after decryption is successful
   */
  get deviceId() {
    return this.#deviceId;
  }

  /**
   * Set the encrypted wallet by providing a string representation
   * @throws {Error} throws if `wallet` is not a valid encrypted wallet string
   */
  set encryptedWallet(wallet: string) {
    this.#encryptedWallet = new CipherString(wallet).encryptedString;
  }

  /**
   * Initialize the wallet with and email and password
   *
   * This cannot be done in the constructor because it performs async operations
   */
  async init(email: string, password: string, encryptedWallet?: string): Promise<EncryptedWallet> {
    if (!(email && typeof email === "string" && email.length > 0)) {
      throw new Error("Invalid email address");
    }
    if (!(password && typeof password === "string" && password.length > 0)) {
      throw new Error("Invalid password");
    }

    this.#email = email.normalize("NFKC").trim().toLowerCase();
    this.#password = password.normalize("NFKC");
    this.#key = await this.#helper.makeKey(this.#password, this.#email);

    if (encryptedWallet) {
      this.encryptedWallet = encryptedWallet;
    }

    return this;
  }

  /**
   * Generate a new mnemonic and encrypt it with the email and password
   */
  async createWallet(mnemonic?: string) {
    if (!this.isInitialized) throw new Error("Wallet is not initialized");
    mnemonic = mnemonic ?? await this.#helper.generateMnemonic();

    if (!bip39.validateMnemonic(mnemonic)) {
      throw new Error("Invalid mnemonic");
    }

    this.#encryptedWallet = (await this.#helper.aesEncrypt(core.toArrayBuffer(utils.fromUtf8ToArray(mnemonic)), this.#key)).toString();

    return this;
  }

  /**
   * Decrypt the encrypted wallet
   * @throws {Error} if the wallet hasn't been initialized or doesn't have an encryptedWallet
   */
  async decrypt(encryptedWallet = this.#encryptedWallet): Promise<string> {
    if (!this.isInitialized) throw new Error("Wallet is not initialized");
    if (!this.encryptedWallet) throw new Error("Wallet does not contain an encrypted wallet");
    const decrypted = await this.#helper.decrypt(new CipherString(encryptedWallet), this.#key);

    if (typeof decrypted === "string" && decrypted.length > 0) {
      this.#deviceId = await this.#helper.getDeviceId(decrypted);
      return decrypted;
    }
    throw new Error("Decryption failed");
  }

  /**
   * Clear all private data to allow it to be garbage collected
   */
  reset() {
    this.#deviceId = undefined;
    this.#email = undefined;
    this.#encryptedWallet = undefined;
    this.#key = undefined;
    this.#password = undefined;
  }
}
