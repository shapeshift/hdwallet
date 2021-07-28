import * as core from "@shapeshiftoss/hdwallet-core"
import * as ethers from "ethers";

import { SecP256K1, Digest } from "../core";

export class SignerAdapter extends ethers.Signer {
  protected readonly _isolatedKey: SecP256K1.ECDSAKey & SecP256K1.ECDHKey;
  readonly provider?: ethers.providers.Provider

  constructor(isolatedKey: SecP256K1.ECDSAKey & SecP256K1.ECDHKey, provider?: ethers.providers.Provider) {
    super();
    this._isolatedKey = isolatedKey;
    this.provider = provider;
  }

  connect(provider: ethers.providers.Provider): SignerAdapter {
    return new SignerAdapter(this._isolatedKey, provider);
  }

  async getAddress(): Promise<string> {
    return ethers.utils.computeAddress(SecP256K1.UncompressedPoint.from(this._isolatedKey.publicKey));
  }

  async signDigest(digest: ethers.BytesLike): Promise<ethers.Signature> {
    const rawSig = await SecP256K1.RecoverableSignature.signCanonically(this._isolatedKey, digest instanceof Uint8Array ? digest : ethers.utils.arrayify(digest));
    return ethers.utils.splitSignature(core.compatibleBufferConcat([rawSig, Buffer.from([rawSig.recoveryParam])]));
  }

  async signTransaction(transaction: ethers.utils.Deferrable<ethers.providers.TransactionRequest>): Promise<string> {
    const tx = await ethers.utils.resolveProperties(transaction);
    if (tx.from != null) {
      if (ethers.utils.getAddress(tx.from) !== await this.getAddress()) {
        throw new Error("transaction from address mismatch");
      }
      delete tx.from;
    }
    const unsignedTx: ethers.UnsignedTransaction = {
      ...tx,
      nonce: tx.nonce !== undefined ? ethers.BigNumber.from(tx.nonce).toNumber() : undefined,
    }

    const txBuf = ethers.utils.arrayify(ethers.utils.serializeTransaction(unsignedTx));
    const signature = await this.signDigest(Digest.Algorithms["keccak256"](txBuf));
    return ethers.utils.serializeTransaction(unsignedTx, signature);
  }

  async signMessage(messageData: ethers.Bytes | string): Promise<string> {
    const messageDataBuf =
      typeof messageData === "string"
        ? Buffer.from(messageData.normalize("NFKD"), "utf8")
        : Buffer.from(ethers.utils.arrayify(messageData));
    const messageBuf = core.compatibleBufferConcat([Buffer.from(`\x19Ethereum Signed Message:\n${messageDataBuf.length}`, "utf8"), messageDataBuf]);
    const signature = await this.signDigest(Digest.Algorithms["keccak256"](messageBuf));
    return ethers.utils.joinSignature(signature);
  }
}

export default SignerAdapter;
