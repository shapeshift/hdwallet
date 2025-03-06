/// <reference types="bip32/types/crypto" />

import { createSHA512, pbkdf2 } from "hash-wasm";

import type { Seed as SeedType } from "../../core/bip32";
import type { Mnemonic as Bip39Mnemonic } from "../../core/bip39";
import { Seed } from "./bip32";
import { Revocable, revocable } from "./revocable";

export * from "../../core/bip39";

export class Mnemonic extends Revocable(class {}) implements Bip39Mnemonic {
  readonly #mnemonic: string;

  protected constructor(mnemonic: string) {
    super();
    this.#mnemonic = mnemonic.normalize("NFKD");
  }

  static async create(mnemonic: string): Promise<Bip39Mnemonic> {
    const obj = new Mnemonic(mnemonic);
    return revocable(obj, (x) => obj.addRevoker(x));
  }

  async toSeed(passphrase?: string): Promise<SeedType> {
    const mnemonic = this.#mnemonic;
    const salt = new TextEncoder().encode(`mnemonic${passphrase ?? ""}`.normalize("NFKD"));

    const out = await Seed.create(
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
