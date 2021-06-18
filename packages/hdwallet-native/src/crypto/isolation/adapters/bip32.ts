import * as bip32 from "bip32";
import bs58check from "bs58check";
import { crypto as btccrypto, Network, SignerAsync } from "@bithighlander/bitcoin-cash-js-lib";

import { BIP32, SecP256K1, IsolationError } from "../core";
import { ECPairAdapter } from "./bitcoin";

export type BIP32InterfaceAsync = Omit<bip32.BIP32Interface, "sign" | "derive" | "deriveHardened" | "derivePath"> &
  Pick<SignerAsync, "sign"> & {
    derive(index: number): BIP32InterfaceAsync;
    deriveHardened(index: number): BIP32InterfaceAsync;
    derivePath(path: string): BIP32InterfaceAsync;
  };

export class BIP32Adapter extends ECPairAdapter implements BIP32.Node, BIP32InterfaceAsync {
  protected readonly _isolatedNode: BIP32.Node;
  readonly index: number;
  readonly _parent?: BIP32Adapter;
  readonly _children = new Map<number, this>();
  _identifier?: Buffer;
  _base58?: string;

  constructor(isolatedNode: BIP32.Node, networkOrParent?: BIP32Adapter | Network, index?: number) {
    super(isolatedNode, networkOrParent instanceof BIP32Adapter ? networkOrParent.network : networkOrParent);
    this._isolatedNode = isolatedNode;
    this.index = index ?? 0;
    if (networkOrParent instanceof BIP32Adapter) this._parent = networkOrParent;
  }

  get depth(): number {
    return (this._parent?.depth ?? -1) + 1;
  }
  get chainCode() {
    return Buffer.from(this._isolatedNode.chainCode) as Buffer & BIP32.ChainCode;
  }
  get identifier() {
    return (this._identifier =
      this._identifier ?? btccrypto.hash160(Buffer.from(SecP256K1.CompressedPoint.from(this._isolatedKey.publicKey))));
  }
  get fingerprint() {
    return this.identifier.slice(0, 4);
  }
  get parentFingerprint() {
    return this._parent ? this._parent.fingerprint.readUInt32BE(0) : 0;
  }

  get path(): string {
    if (!this._parent) return "";
    let parentPath = this._parent.path ?? "";
    if (parentPath === "") parentPath = "m";
    const hardened = this.index >= 0x80000000;
    const index = hardened ? this.index - 0x80000000 : this.index;
    return `${parentPath}/${index}${hardened ? "'" : ""}`;
  }

  get publicKey() {
    return Buffer.from(SecP256K1.CompressedPoint.from(this._isolatedNode.publicKey)) as Buffer &
      SecP256K1.CompressedPoint;
  }

  isNeutered() {
    return false;
  }
  neutered() {
    if (!this._base58) {
      const xpub = Buffer.alloc(78);
      xpub.writeUInt32BE(this.network.bip32.public, 0);
      xpub.writeUInt8(this.depth, 4);
      xpub.writeUInt32BE(this.parentFingerprint, 5);
      xpub.writeUInt32BE(this.index, 9);
      xpub.set(this.chainCode, 13);
      xpub.set(this.publicKey, 45);
      this._base58 = bs58check.encode(xpub);
    }
    return bip32.fromBase58(this._base58, this.network);
  }

  toBase58(): never {
    throw new IsolationError("xpriv");
  }

  derive(index: number): this {
    let out = this._children.get(index);
    if (!out) {
      out = new BIP32Adapter(this._isolatedNode.derive(index), this, index) as this;
      this._children.set(index, out);
    }
    return out;
  }
  deriveHardened(index: number): BIP32Adapter {
    return this.derive(index + 0x80000000);
  }

  derivePath(path: string): BIP32Adapter {
    const ownPath = this.path;
    if (path.startsWith(ownPath)) path = path.slice(ownPath.length);
    if (/^m/.test(path) && this._parent) throw new Error("expected master, got child");
    return BIP32.derivePath<BIP32Adapter>(this, path);
  }
}

export default BIP32Adapter;
