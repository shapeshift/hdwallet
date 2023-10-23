/// <reference types="bip32/types/crypto" />

import * as core from "@shapeshiftoss/hdwallet-core";
import * as bip32crypto from "bip32/src/crypto";
import { TextEncoder } from "web-encoding";

import * as BIP32 from "../../core/bip32";
import * as BIP39 from "../../core/bip39";
import { safeBufferFrom } from "../../types";
import * as BIP32Engine from "./bip32";
import { Revocable, revocable } from "./revocable";

export * from "../../core/bip39";

// Poor man's single-block PBKDF2 implementation
//TODO: get something better
function pbkdf2_sha512_singleblock(
  password: string,
  salt: Uint8Array,
  iterations: number
): Uint8Array & { length: 64 } {
  function be32Buf(index: number): Buffer {
    const indexBE = Buffer.alloc(4);
    indexBE.writeUInt32BE(index);
    return indexBE;
  }

  const pwBuffer = safeBufferFrom(new TextEncoder().encode(password));

  const out = bip32crypto.hmacSHA512(pwBuffer, core.compatibleBufferConcat([salt, be32Buf(1)])) as Buffer & {
    length: 64;
  };
  let lastU = out;
  for (let i = 2; i <= iterations; i++) {
    const newU = bip32crypto.hmacSHA512(pwBuffer, lastU) as Buffer & { length: 64 };
    for (let j = 0; j < out.length; j++) out[j] ^= newU[j];
    lastU = newU;
  }

  return out;
}

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

    const out = await BIP32Engine.Seed.create(pbkdf2_sha512_singleblock(mnemonic, salt, 2048));
    this.addRevoker(() => out.revoke?.());
    return out;
  }
}
