import { Stark } from "../core";

/**
 * Stark curve adapter for Starknet
 *
 * Simple wrapper around Stark.Node providing derivation utilities.
 * The Stark Node handles all Starknet-specific operations (key grinding,
 * STARK curve public keys, and ECDSA signing on STARK curve).
 */
export class StarkAdapter {
  readonly node: Stark.Node;

  constructor(node: Stark.Node) {
    this.node = node;
  }

  async getPublicKey(): Promise<string> {
    return this.node.getPublicKey();
  }

  async derive(index: number): Promise<this> {
    return new StarkAdapter(await this.node.derive(index)) as this;
  }

  async derivePath(path: string): Promise<StarkAdapter> {
    return Stark.derivePath<StarkAdapter>(this, path);
  }
}

export default StarkAdapter;
