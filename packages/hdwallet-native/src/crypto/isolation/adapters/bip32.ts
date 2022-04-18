import type { crypto as btccrypto, Network, SignerAsync } from "@shapeshiftoss/bitcoinjs-lib";
import * as bip32 from "bip32";
import bs58check from "bs58check";
import PLazy from "p-lazy";

import { BIP32, IsolationError, SecP256K1 } from "../core";
import { ECPairAdapter } from "./bitcoin";

let btccryptoInstance: typeof btccrypto | undefined;
const btccryptoReady = PLazy.from(async () => {
  btccryptoInstance = (await import("@shapeshiftoss/bitcoinjs-lib")).crypto;
});

export type BIP32InterfaceAsync = Omit<bip32.BIP32Interface, "sign" | "derive" | "deriveHardened" | "derivePath"> &
  Pick<SignerAsync, "sign"> & {
    derive(index: number): Promise<BIP32InterfaceAsync>;
    deriveHardened(index: number): Promise<BIP32InterfaceAsync>;
    derivePath(path: string): Promise<BIP32InterfaceAsync>;
  };

export class BIP32Adapter extends ECPairAdapter implements BIP32InterfaceAsync {
  readonly node: BIP32.Node;
  readonly _chainCode: BIP32.ChainCode;
  readonly _publicKey: SecP256K1.CurvePoint;
  readonly index: number;
  readonly _parent?: BIP32Adapter;
  readonly _children = new Map<number, this>();
  _identifier?: Buffer;
  _base58?: string;

  /**
   * If you're inheriting from this class, be sure to call `await BIP32Adapter.prepare()` in your `create()` overload.
   */
  protected constructor(
    node: BIP32.Node,
    chainCode: BIP32.ChainCode,
    publicKey: SecP256K1.CurvePoint,
    networkOrParent?: BIP32Adapter | Network,
    index?: number
  ) {
    super(node, publicKey, networkOrParent instanceof BIP32Adapter ? networkOrParent.network : networkOrParent);
    this.node = node;
    this._chainCode = chainCode;
    this._publicKey = publicKey;
    this.index = index ?? 0;
    if (networkOrParent instanceof BIP32Adapter) this._parent = networkOrParent;
  }

  protected static async prepare(): Promise<void> {
    // Must await superclass's prepare() so it can do its lazy-loading.
    await Promise.all([await btccryptoReady, ECPairAdapter.prepare()]);
  }

  static async create(
    isolatedNode: BIP32.Node,
    networkOrParent?: BIP32Adapter | Network,
    index?: number
  ): Promise<BIP32Adapter> {
    await this.prepare();
    return new BIP32Adapter(
      isolatedNode,
      await isolatedNode.getChainCode(),
      await isolatedNode.getPublicKey(),
      networkOrParent,
      index
    );
  }

  get depth(): number {
    return (this._parent?.depth ?? -1) + 1;
  }
  get chainCode() {
    return Buffer.from(this._chainCode) as Buffer & BIP32.ChainCode;
  }
  getChainCode() {
    return this.chainCode;
  }
  get identifier() {
    return (this._identifier =
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      this._identifier ?? btccryptoInstance!.hash160(Buffer.from(SecP256K1.CompressedPoint.from(this.publicKey))));
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
    return Buffer.from(SecP256K1.CompressedPoint.from(this._publicKey)) as Buffer & SecP256K1.CompressedPoint;
  }
  getPublicKey() {
    return this.publicKey;
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
    throw new IsolationError("xprv");
  }

  async derive(index: number): Promise<this> {
    let out = this._children.get(index);
    if (!out) {
      out = (await BIP32Adapter.create(await this.node.derive(index), this, index)) as this;
      this._children.set(index, out);
    }
    return out;
  }
  async deriveHardened(index: number): Promise<BIP32Adapter> {
    return await this.derive(index + 0x80000000);
  }

  async derivePath(path: string): Promise<BIP32Adapter> {
    const ownPath = this.path;
    if (path.startsWith(ownPath)) path = path.slice(ownPath.length);
    if (/^m/.test(path) && this._parent) throw new Error("expected master, got child");
    return await BIP32.derivePath<BIP32Adapter>(this, path);
  }
}

export default BIP32Adapter;
