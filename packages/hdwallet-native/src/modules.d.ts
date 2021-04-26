/// <reference types="bip32/types/crypto" />

declare module 'cosmos-tx-builder';
declare module 'ethereum-tx-decoder';
declare module '@fioprotocol/fiojs/dist/ecc';
declare module 'bip32/src/crypto' {
    export * from "bip32/types/crypto";
}
