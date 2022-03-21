import * as core from "@shapeshiftoss/hdwallet-core";
import * as ethers from "ethers";

import { SecP256K1 } from "../core";

function ethSigFromRecoverableSig(x: SecP256K1.RecoverableSignature): ethers.Signature {
  const sig = SecP256K1.RecoverableSignature.sig(x);
  const recoveryParam = SecP256K1.RecoverableSignature.recoveryParam(x);
  return ethers.utils.splitSignature(core.compatibleBufferConcat([sig, Buffer.from([recoveryParam])]));
}

export class SignerAdapter extends ethers.Signer {
  protected readonly _isolatedKey: SecP256K1.ECDSAKey;
  readonly provider?: ethers.providers.Provider;

  protected constructor(isolatedKey: SecP256K1.ECDSAKey, provider?: ethers.providers.Provider) {
    super();
    this._isolatedKey = isolatedKey;
    this.provider = provider;
  }

  static async create(isolatedKey: SecP256K1.ECDSAKey, provider?: ethers.providers.Provider): Promise<SignerAdapter> {
    return new SignerAdapter(isolatedKey, provider);
  }

  // This throws (as allowed by ethers.Signer) to avoid having to return an object which is initialized asynchronously
  // from a synchronous function. Because all the (other) methods on SignerAdapter are async, one could construct a
  // wrapper that deferred its initialization and awaited it before calling through to a "real" method, but that's
  // a lot of complexity just to implement this one method we don't actually use.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  connect(_provider: ethers.providers.Provider): never {
    throw new Error("changing providers on a SignerAdapter is unsupported");
  }

  async getAddress(): Promise<string> {
    return ethers.utils.computeAddress(SecP256K1.UncompressedPoint.from(await this._isolatedKey.getPublicKey()));
  }

  async signDigest(digest: ethers.BytesLike): Promise<ethers.Signature> {
    const recoverableSig = await SecP256K1.RecoverableSignature.signCanonically(
      this._isolatedKey,
      null,
      digest instanceof Uint8Array ? digest : ethers.utils.arrayify(digest)
    );
    const sig = SecP256K1.RecoverableSignature.sig(recoverableSig);
    const recoveryParam = SecP256K1.RecoverableSignature.recoveryParam(recoverableSig);
    return ethers.utils.splitSignature(core.compatibleBufferConcat([sig, Buffer.from([recoveryParam])]));
  }

  async signTransaction(transaction: ethers.utils.Deferrable<ethers.providers.TransactionRequest>): Promise<string> {
    const tx = await ethers.utils.resolveProperties(transaction);
    if (tx.from != null) {
      if (ethers.utils.getAddress(tx.from) !== (await this.getAddress())) {
        throw new Error("transaction from address mismatch");
      }
      delete tx.from;
    }
    const unsignedTx: ethers.UnsignedTransaction = {
      ...tx,
      nonce: tx.nonce !== undefined ? ethers.BigNumber.from(tx.nonce).toNumber() : undefined,
    };

    const txBuf = ethers.utils.arrayify(ethers.utils.serializeTransaction(unsignedTx));
    const rawSig = await SecP256K1.RecoverableSignature.signCanonically(this._isolatedKey, "keccak256", txBuf);
    return ethers.utils.serializeTransaction(unsignedTx, ethSigFromRecoverableSig(rawSig));
  }

  async signMessage(messageData: ethers.Bytes | string): Promise<string> {
    const messageDataBuf =
      typeof messageData === "string"
        ? Buffer.from(messageData.normalize("NFKD"), "utf8")
        : Buffer.from(ethers.utils.arrayify(messageData));
    const messageBuf = core.compatibleBufferConcat([
      Buffer.from(`\x19Ethereum Signed Message:\n${messageDataBuf.length}`, "utf8"),
      messageDataBuf,
    ]);
    const rawSig = await SecP256K1.RecoverableSignature.signCanonically(this._isolatedKey, "keccak256", messageBuf);
    return ethers.utils.joinSignature(ethSigFromRecoverableSig(rawSig));
  }
}

export default SignerAdapter;
