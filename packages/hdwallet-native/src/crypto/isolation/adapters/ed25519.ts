import { Ed25519 } from "../core";

export class Ed25519Adapter {
  readonly node: Ed25519.Node;

  constructor(node: Ed25519.Node) {
    this.node = node;
  }

  async getPublicKey(): Promise<Uint8Array> {
    return this.node.getPublicKey();
  }

  async derive(index: number): Promise<this> {
    return new Ed25519Adapter(await this.node.derive(index)) as this;
  }

  async derivePath(path: string): Promise<Ed25519Adapter> {
    return Ed25519.derivePath<Ed25519Adapter>(this, path);
  }
}

export default Ed25519Adapter;
