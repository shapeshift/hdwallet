import * as BIP32 from "../bip32";

export interface MnemonicInterface {
    toSeed(passphrase?: string): BIP32.SeedInterface;
}
