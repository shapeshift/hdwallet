import { Revocable } from "..";
import * as BIP32 from "../bip32";

export interface Mnemonic extends Partial<Revocable> {
  toSeed(passphrase?: string): Promise<BIP32.Seed>;
}
