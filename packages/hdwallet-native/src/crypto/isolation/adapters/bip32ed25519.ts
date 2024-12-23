import { Ed25519Node } from "../core/ed25519";
import { ByteArray } from "../types";

export class BIP32Ed25519Adapter {
  readonly node: Ed25519Node;

  private constructor(node: Ed25519Node) {
    this.node = node;
  }

  static async fromNode(node: Ed25519Node): Promise<BIP32Ed25519Adapter> {
    return new BIP32Ed25519Adapter(node);
  }

  async getPublicKey(): Promise<ByteArray> {
    const publicKey = await this.node.getPublicKey();
    return Buffer.from(publicKey);
  }

  async derivePath(path: string): Promise<BIP32Ed25519Adapter> {
    let currentNode = this.node;

    if (path === "m" || path === "M" || path === "m'" || path === "M'") {
      return this;
    }

    const segments = path
      .toLowerCase()
      .split("/")
      .filter((segment) => segment !== "m");

    for (const segment of segments) {
      const index = parseInt(segment.replace("'", ""));
      currentNode = await currentNode.derive(index);
    }

    return new BIP32Ed25519Adapter(currentNode);
  }
}

export default BIP32Ed25519Adapter;
