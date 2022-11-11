import * as core from "@keepkey/hdwallet-core";
import * as ethers from "ethers";

import { Isolation } from "../..";
import { SecP256K1 } from "../core";

function ethSigFromRecoverableSig(x: SecP256K1.RecoverableSignature): ethers.Signature {
  const sig = SecP256K1.RecoverableSignature.sig(x);
  const recoveryParam = SecP256K1.RecoverableSignature.recoveryParam(x);
  return ethers.utils.splitSignature(core.compatibleBufferConcat([sig, Buffer.from([recoveryParam])]));
}

export class SignerAdapter {
  protected readonly nodeAdapter: Isolation.Adapters.BIP32;
  readonly provider?: ethers.providers.Provider;

  constructor(nodeAdapter: Isolation.Adapters.BIP32, provider?: ethers.providers.Provider) {
    this.nodeAdapter = nodeAdapter;
    this.provider = provider;
  }

  // This throws (as allowed by ethers.Signer) to avoid having to return an object which is initialized asynchronously
  // from a synchronous function. Because all the (other) methods on SignerAdapter are async, one could construct a
  // wrapper that deferred its initialization and awaited it before calling through to a "real" method, but that's
  // a lot of complexity just to implement this one method we don't actually use.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  connect(_provider: ethers.providers.Provider): never {
    throw new Error("changing providers on a SignerAdapter is unsupported");
  }

  async getAddress(addressNList: core.BIP32Path): Promise<string> {
    const nodeAdapter = await this.nodeAdapter.derivePath(core.addressNListToBIP32(addressNList));
    return ethers.utils.computeAddress(SecP256K1.UncompressedPoint.from(nodeAdapter.getPublicKey()));
  }

  async signDigest(digest: ethers.BytesLike, addressNList: core.BIP32Path): Promise<ethers.Signature> {
    const nodeAdapter = await this.nodeAdapter.derivePath(core.addressNListToBIP32(addressNList));
    const recoverableSig = await SecP256K1.RecoverableSignature.signCanonically(
      nodeAdapter.node,
      null,
      digest instanceof Uint8Array ? digest : ethers.utils.arrayify(digest)
    );
    const sig = SecP256K1.RecoverableSignature.sig(recoverableSig);
    const recoveryParam = SecP256K1.RecoverableSignature.recoveryParam(recoverableSig);
    return ethers.utils.splitSignature(core.compatibleBufferConcat([sig, Buffer.from([recoveryParam])]));
  }

  async signTransaction(
    transaction: ethers.utils.Deferrable<ethers.providers.TransactionRequest>,
    addressNList: core.BIP32Path
  ): Promise<string> {
    const tx = await ethers.utils.resolveProperties(transaction);
    if (tx.from != null) {
      if (ethers.utils.getAddress(tx.from) !== (await this.getAddress(addressNList))) {
        throw new Error("transaction from address mismatch");
      }
      delete tx.from;
    }
    const unsignedTx: ethers.UnsignedTransaction = {
      ...tx,
      nonce: tx.nonce !== undefined ? ethers.BigNumber.from(tx.nonce).toNumber() : undefined,
    };

    const nodeAdapter = await this.nodeAdapter.derivePath(core.addressNListToBIP32(addressNList));
    const txBuf = ethers.utils.arrayify(ethers.utils.serializeTransaction(unsignedTx));
    const rawSig = await SecP256K1.RecoverableSignature.signCanonically(nodeAdapter.node, "keccak256", txBuf);
    return ethers.utils.serializeTransaction(unsignedTx, ethSigFromRecoverableSig(rawSig));
  }

  async signMessage(messageData: ethers.Bytes | string, addressNList: core.BIP32Path): Promise<string> {
    const messageDataBuf =
      typeof messageData === "string"
        ? Buffer.from(messageData.normalize("NFKD"), "utf8")
        : Buffer.from(ethers.utils.arrayify(messageData));
    const messageBuf = core.compatibleBufferConcat([
      Buffer.from(`\x19Ethereum Signed Message:\n${messageDataBuf.length}`, "utf8"),
      messageDataBuf,
    ]);
    const nodeAdapter = await this.nodeAdapter.derivePath(core.addressNListToBIP32(addressNList));
    const rawSig = await SecP256K1.RecoverableSignature.signCanonically(nodeAdapter.node, "keccak256", messageBuf);
    return ethers.utils.joinSignature(ethSigFromRecoverableSig(rawSig));
  }
}

export default SignerAdapter;
