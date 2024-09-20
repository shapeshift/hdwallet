import * as core from "@shapeshiftoss/hdwallet-core";
import { getMessage, TypedData } from "eip-712";
import { BigNumber, BytesLike, providers, Signature, UnsignedTransaction } from "ethers";
import {
  arrayify,
  computeAddress,
  Deferrable,
  getAddress,
  joinSignature,
  resolveProperties,
  serializeTransaction,
  splitSignature,
} from "ethers/lib/utils.js";

import { Isolation } from "../..";
import { SecP256K1 } from "../core";

function ethSigFromRecoverableSig(x: SecP256K1.RecoverableSignature): Signature {
  const sig = SecP256K1.RecoverableSignature.sig(x);
  const recoveryParam = SecP256K1.RecoverableSignature.recoveryParam(x);
  return splitSignature(core.compatibleBufferConcat([sig, Buffer.from([recoveryParam])]));
}

export class SignerAdapter {
  protected readonly nodeAdapter: Isolation.Adapters.BIP32;
  readonly provider?: providers.Provider;

  constructor(nodeAdapter: Isolation.Adapters.BIP32, provider?: providers.Provider) {
    this.nodeAdapter = nodeAdapter;
    this.provider = provider;
  }

  // This throws (as allowed by ethers.Signer) to avoid having to return an object which is initialized asynchronously
  // from a synchronous function. Because all the (other) methods on SignerAdapter are async, one could construct a
  // wrapper that deferred its initialization and awaited it before calling through to a "real" method, but that's
  // a lot of complexity just to implement this one method we don't actually use.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  connect(_provider: providers.Provider): never {
    throw new Error("changing providers on a SignerAdapter is unsupported");
  }

  async getAddress(addressNList: core.BIP32Path): Promise<string> {
    const nodeAdapter = await this.nodeAdapter.derivePath(core.addressNListToBIP32(addressNList));
    return computeAddress(SecP256K1.UncompressedPoint.from(nodeAdapter.getPublicKey()));
  }

  async signDigest(digest: BytesLike, addressNList: core.BIP32Path): Promise<Signature> {
    const nodeAdapter = await this.nodeAdapter.derivePath(core.addressNListToBIP32(addressNList));
    const recoverableSig = await SecP256K1.RecoverableSignature.signCanonically(
      nodeAdapter.node,
      null,
      digest instanceof Uint8Array ? digest : arrayify(digest)
    );
    const sig = SecP256K1.RecoverableSignature.sig(recoverableSig);
    const recoveryParam = SecP256K1.RecoverableSignature.recoveryParam(recoverableSig);
    return splitSignature(core.compatibleBufferConcat([sig, Buffer.from([recoveryParam])]));
  }

  async signTransaction(
    transaction: Deferrable<providers.TransactionRequest>,
    addressNList: core.BIP32Path
  ): Promise<string> {
    const tx = await resolveProperties(transaction);
    if (tx.from != null) {
      if (getAddress(tx.from) !== (await this.getAddress(addressNList))) {
        throw new Error("transaction from address mismatch");
      }
      delete tx.from;
    }
    const unsignedTx: UnsignedTransaction = {
      ...tx,
      nonce: tx.nonce !== undefined ? BigNumber.from(tx.nonce).toNumber() : undefined,
    };

    const nodeAdapter = await this.nodeAdapter.derivePath(core.addressNListToBIP32(addressNList));
    const txBuf = arrayify(serializeTransaction(unsignedTx));
    const rawSig = await SecP256K1.RecoverableSignature.signCanonically(nodeAdapter.node, "keccak256", txBuf);
    return serializeTransaction(unsignedTx, ethSigFromRecoverableSig(rawSig));
  }

  async signMessage(messageData: BytesLike, addressNList: core.BIP32Path): Promise<string> {
    const messageBuf = core.buildMessage(messageData);
    const nodeAdapter = await this.nodeAdapter.derivePath(core.addressNListToBIP32(addressNList));
    const rawSig = await SecP256K1.RecoverableSignature.signCanonically(nodeAdapter.node, "keccak256", messageBuf);
    return joinSignature(ethSigFromRecoverableSig(rawSig));
  }

  async signTypedData(typedData: TypedData, addressNList: core.BIP32Path): Promise<core.ETHSignedTypedData> {
    const address = await this.getAddress(addressNList);
    const messageArray = getMessage(typedData);
    const nodeAdapter = await this.nodeAdapter.derivePath(core.addressNListToBIP32(addressNList));
    const rawSig = await SecP256K1.RecoverableSignature.signCanonically(nodeAdapter.node, "keccak256", messageArray);
    const signature = joinSignature(ethSigFromRecoverableSig(rawSig));
    return { address, signature };
  }
}

export default SignerAdapter;
