import { toArrayBuffer } from "@shapeshiftoss/hdwallet-core";
import * as bs58check from "bs58check";

import * as BIP32 from "../../core/bip32";
import * as BIP39 from "../../core/bip39";
import * as Digest from "../../core/digest";
import * as SecP256K1 from "../../core/secp256k1";
import { checkType } from "../../types";

import * as BIP32Engine from "./bip32";
import { ParsedXpubTree } from "./types";

export * from "../../core/bip39";

export class Mnemonic implements BIP39.Mnemonic {
    readonly xpubTree: ParsedXpubTree;

    protected constructor(xpubTree: ParsedXpubTree) {
        this.xpubTree = xpubTree;
    }

    static async create(xpubList: string): Promise<BIP39.Mnemonic> {
        const parsedXpubs: ParsedXpubTree[] = xpubList.split(" ").map(xpub => {
            const xpubBuf = bs58check.decode(xpub);
            if (xpubBuf.length !== 78) throw new Error("bad xpub: ")
            const xpubView = new DataView(toArrayBuffer(xpubBuf));
            const pk = checkType(SecP256K1.CompressedPoint, xpubBuf.slice(45));
            return {
                version: xpubView.getUint32(0),
                depth: xpubView.getUint8(4),
                parentFp: xpubView.getUint32(5),
                childNum: xpubView.getUint32(9),
                chainCode: checkType(BIP32.ChainCode, xpubBuf.slice(13, 45)),
                publicKey: pk,
                fingerprint: new DataView(toArrayBuffer(Digest.Algorithms.hash160(pk))).getUint32(0),
                children: new Map()
            };
        });

        const tree: ParsedXpubTree = (() => {
            const rootXpubs = parsedXpubs.filter(x => x.parentFp === 0x00000000);
            if (rootXpubs.length === 0) throw new Error("can't find root xpub");
            if (rootXpubs.length > 1) throw new Error("more than one root xpub");
            return rootXpubs[0];
        })();

        const xpubsByFp = parsedXpubs.map(xpub => {
            return [xpub.fingerprint, xpub] as const
        }).reduce<Record<number, ParsedXpubTree>>((a, [k, v]) => {
            if (k in a) throw new Error("key fingerprint collision");
            a[k] = v;
            return a;
        }, {});

        for (const xpub of parsedXpubs.filter(x => x !== tree)) {
            if (!(xpub.parentFp in xpubsByFp)) throw new Error("found xpub, but not its parent");
            xpubsByFp[xpub.parentFp].children.set(xpub.childNum, xpub);
        }

        return new Mnemonic(tree);
    }

    toSeed(): Promise<BIP32.Seed>
    toSeed(passphrase: ""): Promise<BIP32.Seed>
    toSeed(passphrase: string): never
    async toSeed(passphrase?: string): Promise<BIP32.Seed> {
        if (passphrase !== undefined && passphrase !== "") throw new Error("bad passphrase type");

        return await BIP32Engine.Seed.create(this.xpubTree);
    };
}
