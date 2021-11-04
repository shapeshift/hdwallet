import * as BIP32 from "../bip32";

export interface Mnemonic {
    toSeed(passphrase?: string): Promise<BIP32.Seed>;
}
