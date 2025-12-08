import { keccak256 } from "@ethersproject/keccak256";
import * as core from "@shapeshiftoss/hdwallet-core";
import bs58check from "bs58check";

import { Isolation } from "../..";
import { SecP256K1 } from "../core";

const TRON_ADDRESS_PREFIX = 0x41;

export class TronAdapter {
  protected readonly nodeAdapter: Isolation.Adapters.BIP32;

  constructor(nodeAdapter: Isolation.Adapters.BIP32) {
    this.nodeAdapter = nodeAdapter;
  }

  /**
   * Get TRON address from BIP32 path
   * Address generation:
   * 1. Get uncompressed public key (65 bytes)
   * 2. Remove first byte (0x04)
   * 3. Hash with Keccak256
   * 4. Take last 20 bytes
   * 5. Prepend 0x41
   * 6. Base58check encode
   */
  async getAddress(addressNList: core.BIP32Path): Promise<string> {
    const nodeAdapter = await this.nodeAdapter.derivePath(core.addressNListToBIP32(addressNList));
    const publicKey = SecP256K1.UncompressedPoint.from(nodeAdapter.getPublicKey());

    // Remove the 0x04 prefix from uncompressed public key
    const publicKeyBytes = publicKey.slice(1);

    // Hash with Keccak256
    const hash = keccak256("0x" + Buffer.from(publicKeyBytes).toString("hex"));

    // Take last 20 bytes and prepend 0x41 (TRON prefix)
    const addressBytes = Buffer.concat([Buffer.from([TRON_ADDRESS_PREFIX]), Buffer.from(hash.slice(-40), "hex")]);

    // Base58check encode
    return bs58check.encode(addressBytes);
  }

  /**
   * Sign TRON transaction
   * Transaction signing:
   * 1. Get raw transaction hex
   * 2. Hash with SHA256 (NOT Keccak256)
   * 3. Sign with secp256k1
   * 4. Return hex signature
   */
  async signTransaction(rawDataHex: string, addressNList: core.BIP32Path): Promise<string> {
    const nodeAdapter = await this.nodeAdapter.derivePath(core.addressNListToBIP32(addressNList));
    const txBuf = Buffer.from(rawDataHex, "hex");

    // TRON uses SHA256 for transaction signing
    const recoverableSig = await SecP256K1.RecoverableSignature.signCanonically(nodeAdapter.node, "sha256", txBuf);

    const sig = SecP256K1.RecoverableSignature.sig(recoverableSig);
    const recoveryParam = SecP256K1.RecoverableSignature.recoveryParam(recoverableSig);

    // Concatenate signature (64 bytes) + recovery param (1 byte)
    const fullSig = core.compatibleBufferConcat([sig, Buffer.from([recoveryParam])]);

    return fullSig.toString("hex");
  }
}

export default TronAdapter;
