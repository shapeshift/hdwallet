import * as BIP32 from "../bip32";

export interface Mnemonic {
    toSeed(passphrase?: string): BIP32.Seed;
}
