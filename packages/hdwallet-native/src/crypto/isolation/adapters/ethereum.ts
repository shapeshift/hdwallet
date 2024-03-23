import * as core from "@shapeshiftoss/hdwallet-core";
import { getMessage, TypedData } from "eip-712";
import {
  BytesLike,
  computeAddress,
  getAddress,
  getBytes,
  Provider,
  resolveProperties,
  SigningKey,
  Transaction,
  TransactionLike,
  TransactionRequest,
} from "ethers";
import { hexToSignature, Signature, signatureToHex, toHex } from "viem";

import { buildMessage } from "../../../util";
import { Isolation } from "../..";
import { SecP256K1 } from "../core";

function ethSigFromRecoverableSig(x: SecP256K1.RecoverableSignature): Signature {
  const sig = SecP256K1.RecoverableSignature.sig(x);
  const recoveryParam = SecP256K1.RecoverableSignature.recoveryParam(x);
  return hexToSignature(toHex(core.compatibleBufferConcat([sig, Buffer.from([recoveryParam])])));
}

export class SignerAdapter {
  protected readonly nodeAdapter: Isolation.Adapters.BIP32;
  readonly provider?: Provider;

  constructor(nodeAdapter: Isolation.Adapters.BIP32, provider?: Provider) {
    this.nodeAdapter = nodeAdapter;
    this.provider = provider;
  }

  // This throws (as allowed by ethers.Signer) to avoid having to return an object which is initialized asynchronously
  // from a synchronous function. Because all the (other) methods on SignerAdapter are async, one could construct a
  // wrapper that deferred its initialization and awaited it before calling through to a "real" method, but that's
  // a lot of complexity just to implement this one method we don't actually use.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  connect(_provider: Provider): never {
    throw new Error("changing providers on a SignerAdapter is unsupported");
  }

  async getAddress(addressNList: core.BIP32Path): Promise<string> {
    const nodeAdapter = await this.nodeAdapter.derivePath(core.addressNListToBIP32(addressNList));
    return computeAddress(new SigningKey(SecP256K1.UncompressedPoint.from(nodeAdapter.getPublicKey())));
  }

  async signDigest(digest: BytesLike, addressNList: core.BIP32Path): Promise<Signature> {
    const nodeAdapter = await this.nodeAdapter.derivePath(core.addressNListToBIP32(addressNList));
    const recoverableSig = await SecP256K1.RecoverableSignature.signCanonically(
      nodeAdapter.node,
      null,
      digest instanceof Uint8Array ? digest : getBytes(digest)
    );
    const sig = SecP256K1.RecoverableSignature.sig(recoverableSig);
    const recoveryParam = SecP256K1.RecoverableSignature.recoveryParam(recoverableSig);
    return hexToSignature(toHex(core.compatibleBufferConcat([sig, Buffer.from([recoveryParam])])));
  }

  async signTransaction(transaction: TransactionRequest, addressNList: core.BIP32Path): Promise<string> {
    const tx = await resolveProperties(transaction);
    if (tx.from != null) {
      // This can be string | Addressable, where Addressable is an object containing getAddress()
      // for ENS names. We can safely narrow it down to a string, as we do not instantiate contracts with an ens name.
      if (getAddress(tx.from as string) !== (await this.getAddress(addressNList))) {
        throw new Error("transaction from address mismatch");
      }
      delete tx.from;
    }
    const unsignedTx = {
      ...tx,
      nonce: tx?.nonce !== undefined ? tx!.nonce : undefined,
    } as TransactionLike<string>;

    const nodeAdapter = await this.nodeAdapter.derivePath(core.addressNListToBIP32(addressNList));
    const txBuf = getBytes(Transaction.from(unsignedTx).serialized);
    const rawSig = await SecP256K1.RecoverableSignature.signCanonically(nodeAdapter.node, "keccak256", txBuf);
    return Transaction.from({
      ...unsignedTx,
      signature: ethSigFromRecoverableSig(rawSig),
    }).serialized;
  }

  async signMessage(messageData: BytesLike, addressNList: core.BIP32Path): Promise<string> {
    const messageBuf = buildMessage(messageData);
    const nodeAdapter = await this.nodeAdapter.derivePath(core.addressNListToBIP32(addressNList));
    const rawSig = await SecP256K1.RecoverableSignature.signCanonically(nodeAdapter.node, "keccak256", messageBuf);
    return signatureToHex(ethSigFromRecoverableSig(rawSig));
  }

  async signTypedData(typedData: TypedData, addressNList: core.BIP32Path): Promise<core.ETHSignedTypedData> {
    const address = await this.getAddress(addressNList);
    const messageArray = getMessage(typedData);
    const nodeAdapter = await this.nodeAdapter.derivePath(core.addressNListToBIP32(addressNList));
    const rawSig = await SecP256K1.RecoverableSignature.signCanonically(nodeAdapter.node, "keccak256", messageArray);
    const signature = signatureToHex(ethSigFromRecoverableSig(rawSig));
    return { address, signature };
  }
}

export default SignerAdapter;
