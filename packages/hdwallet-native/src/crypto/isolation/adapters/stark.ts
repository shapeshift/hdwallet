import { Stark } from "../core";

/**
 * Stark curve adapter for Starknet
 *
 * Simple wrapper around Stark.Node providing derivation utilities.
 * The Stark Node handles all Starknet-specific operations (key grinding,
 * STARK curve public keys, and ECDSA signing on STARK curve).
 *
 * STARK Curve Specifications:
 * - Curve type: Weierstrass (y² = x³ + ax + b)
 * - Prime field (p): 2^251 + 17×2^192 + 1 (251-bit)
 * - Curve parameters: a = 1, b = π (3141592...)
 * - Curve order (n): 252-bit
 *
 * References:
 * - STARK Curve Spec: https://docs.starkware.co/starkex/crypto/stark-curve.html
 * - Key Derivation: https://docs.starkware.co/starkex/crypto/key-derivation.html
 * - Account Standard: https://community.starknet.io/t/account-keys-and-addresses-derivation-standard/1230
 * - Starknet Cryptography: https://docs.starknet.io/architecture/cryptography/
 * - @scure/starknet: https://github.com/paulmillr/scure-starknet
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
