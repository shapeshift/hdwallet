import * as core from "@shapeshiftoss/hdwallet-core";

import { BIP32, IsolationError } from "../core";
import { Path } from "../core/bip32/types";
import { Ed25519Node } from "../core/ed25519";
import { ByteArray } from "../types";

export class BIP32Ed25519Adapter {
  readonly node: Ed25519Node;
  readonly _chainCode: BIP32.ChainCode;
  readonly _publicKey: ByteArray;
  readonly index: number;
  readonly _parent?: BIP32Ed25519Adapter;
  readonly _children = new Map<number, this>();
  readonly _explicitPath?: string;

  protected constructor(
    node: Ed25519Node,
    chainCode: BIP32.ChainCode,
    publicKey: ByteArray,
    parent?: BIP32Ed25519Adapter,
    index?: number
  ) {
    this.node = node;
    this._chainCode = chainCode;
    this._publicKey = publicKey;
    this.index = index ?? 0;
    this._parent = parent;
    if (node.explicitPath) {
      Path.assert(node.explicitPath);
      this._explicitPath = node.explicitPath;
    }
  }

  static async fromNode(node: Ed25519Node): Promise<BIP32Ed25519Adapter> {
    const ed25519Node = await Ed25519Node.fromIsolatedNode(node);
    return await BIP32Ed25519Adapter.create(ed25519Node);
  }

  static async create(
    isolatedNode: Ed25519Node,
    parent?: BIP32Ed25519Adapter,
    index?: number
  ): Promise<BIP32Ed25519Adapter> {
    return new BIP32Ed25519Adapter(
      isolatedNode,
      await isolatedNode.getChainCode(),
      await isolatedNode.getPublicKey(),
      parent,
      index
    );
  }

  get depth(): number {
    return this.path ? core.bip32ToAddressNList(this.path).length : 0;
  }

  get chainCode() {
    return Buffer.from(this._chainCode) as Buffer & BIP32.ChainCode;
  }

  getChainCode() {
    return this.chainCode;
  }

  get path(): string {
    if (this._explicitPath) return this._explicitPath;
    if (!this._parent) return "";
    let parentPath = this._parent.path ?? "";
    if (parentPath === "") parentPath = "m";
    // Ed25519 only supports hardened derivation
    const index = this.index - 0x80000000;
    return `${parentPath}/${index}'`;
  }

  get publicKey() {
    return Buffer.from(this._publicKey);
  }

  getPublicKey() {
    return this.publicKey;
  }

  isNeutered() {
    return false;
  }

  async derive(index: number): Promise<this> {
    let out = this._children.get(index);
    if (!out) {
      // Ed25519 requires hardened derivation
      if (index < 0x80000000) {
        index += 0x80000000;
      }
      const childNode = await this.node.derive(index);
      out = (await BIP32Ed25519Adapter.create(childNode, this, index)) as this;
      this._children.set(index, out);
    }
    return out;
  }

  async deriveHardened(index: number): Promise<BIP32Ed25519Adapter> {
    return this.derive(index + 0x80000000);
  }

  async derivePath(path: string): Promise<BIP32Ed25519Adapter> {
    if (this._explicitPath) {
      if (!(path.startsWith(this._explicitPath) && path.length >= this._explicitPath.length)) {
        throw new Error("path is not a child of this node");
      }
    }
    const ownPath = this.path;
    if (path.startsWith(ownPath)) path = path.slice(ownPath.length);
    if (path.startsWith("/")) path = path.slice(1);
    if (/^m/.test(path) && this._parent) throw new Error("expected master, got child");

    const segments = path
      .replace("m/", "") // Remove the 'm/' prefix from bip44, we're only interested in akschual parts not root m/ path
      .split("/")
      .filter(Boolean)
      .map((segment) => {
        const hardened = segment.endsWith("'");
        const index = parseInt(hardened ? segment.slice(0, -1) : segment);
        // Ed25519 requires hardened derivation, so all indices should be hardened
        return index + 0x80000000;
      });

    return segments.reduce(
      async (promise: Promise<BIP32Ed25519Adapter>, index) => (await promise).derive(index),
      Promise.resolve(this)
    );
  }

  toBase58(): never {
    throw new IsolationError("xprv");
  }
}

export default BIP32Ed25519Adapter;
