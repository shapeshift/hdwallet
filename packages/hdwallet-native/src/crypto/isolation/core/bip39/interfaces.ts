import { Revocable } from "..";
import * as BIP32 from "../bip32";

export interface TonSeed extends Partial<Revocable> {
  toTonMasterKey(): Promise<import("../ed25519").Node>;
}

export interface Mnemonic extends Partial<Revocable> {
  toSeed(passphrase?: string): Promise<BIP32.Seed>;
  toTonSeed?(password?: string): Promise<TonSeed>;
}
