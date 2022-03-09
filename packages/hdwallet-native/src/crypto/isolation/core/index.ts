export * as BIP32 from "./bip32";
export * as BIP39 from "./bip39";
export * as Digest from "./digest";
export * as SecP256K1 from "./secp256k1";

export class IsolationError extends Error {
    constructor(name: string) {
        super(`this key is isolated -- no ${name} for you!`);
    }
}

export interface Revocable {
    revoke(): void
    addRevoker(revoke: () => void): void
}
