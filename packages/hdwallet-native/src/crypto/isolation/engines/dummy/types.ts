import { ChainCode } from "../../core/bip32";
import { CompressedPoint } from "../../core/secp256k1";

export class DummyEngineError extends Error {
  constructor() {
    super("the dummy isolation engine can't do this because it doesn't have any actual private keys");
  }
}

export interface ParsedXpub {
  version: number
  depth: number
  parentFp: number
  childNum: number
  chainCode: ChainCode
  publicKey: CompressedPoint
}

export type ParsedXpubTree = ParsedXpub & {
  fingerprint: number,
  children: Map<number, ParsedXpubTree>
}
