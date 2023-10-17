/// <reference types="bip32/types/crypto" />

import * as core from "@shapeshiftoss/hdwallet-core";
import * as bip32crypto from "bip32/src/crypto";
import { createSHA512, pbkdf2 } from "hash-wasm";
import { TextEncoder } from "web-encoding";

import * as BIP32 from "../../core/bip32";
import * as BIP39 from "../../core/bip39";
import { safeBufferFrom } from "../../types";
import * as BIP32Engine from "./bip32";
import { Revocable, revocable } from "./revocable";

export * from "../../core/bip39";

export class Mnemonic extends Revocable(class {}) implements BIP39.Mnemonic {
  readonly #mnemonic: string;

  protected constructor(mnemonic: string) {
    super();
    this.#mnemonic = mnemonic.normalize("NFKD");
  }

  static async create(mnemonic: string): Promise<BIP39.Mnemonic> {
    const obj = new Mnemonic(mnemonic);
    return revocable(obj, (x) => obj.addRevoker(x));
  }

  async toSeed(passphrase?: string): Promise<BIP32.Seed> {
    if (passphrase !== undefined && typeof passphrase !== "string") throw new Error("bad passphrase type");

    const mnemonic = this.#mnemonic;
    const salt = new TextEncoder().encode(`mnemonic${passphrase ?? ""}`.normalize("NFKD"));

    const out = await BIP32Engine.Seed.create(
      Buffer.from(
        await pbkdf2({
          password: mnemonic,
          salt,
          iterations: 2048,
          hashLength: 64,
          hashFunction: createSHA512(),
          outputType: "binary",
        })
      )
    );
    this.addRevoker(() => out.revoke?.());
    return out;
  }
}
