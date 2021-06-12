import { SigningKey as ETHSigningKey } from "@ethersproject/signing-key";
import { splitSignature, BytesLike, Signature as ethSignature, arrayify } from "@ethersproject/bytes";
import * as core from "@shapeshiftoss/hdwallet-core"
import * as tinyecc from "tiny-secp256k1";

import { SecP256K1 } from "../core";
import { checkType } from "../types";
import * as Isolation from "..";

export class SigningKeyAdapter implements ETHSigningKey {
  protected readonly _isolatedKey: SecP256K1.ECDSAKeyInterface & SecP256K1.ECDHKeyInterface;
  constructor(isolatedKey: SecP256K1.ECDSAKeyInterface & SecP256K1.ECDHKeyInterface) {
    this._isolatedKey = isolatedKey;
  }

  get _isSigningKey() {
    return true;
  }
  get curve() {
    return "secp256k1";
  }
  get publicKey() {
    return `0x${Buffer.from(SecP256K1.UncompressedPoint.from(this._isolatedKey.publicKey)).toString("hex")}`;
  }
  get compressedPublicKey() {
    return `0x${Buffer.from(SecP256K1.CompressedPoint.from(this._isolatedKey.publicKey)).toString("hex")}`;
  }

  get privateKey() {
    return "";
  }

  _addPoint(other: BytesLike): string {
    if (typeof other === "string") other = Buffer.from((other.startsWith("0x") ? other.slice(2) : other), "hex");
    return `0x${tinyecc.pointAddScalar(Buffer.from(this._isolatedKey.publicKey), Buffer.from(Uint8Array.from(other)), true)}`;
  }
  signDigest(digest: BytesLike): ethSignature {
    const rawSig = SecP256K1.RecoverableSignature.signCanonically(this._isolatedKey, digest instanceof Uint8Array ? digest : arrayify(digest));
    return splitSignature(core.compatibleBufferConcat([rawSig, Buffer.from([rawSig.recoveryParam])]));
  }
  signTx(txData: BytesLike): ethSignature {
    const txBuf = arrayify(txData);
    return this.signDigest(Isolation.Digest.Algorithms["keccak256"](txBuf));
  }
  signMessage(messageData: BytesLike | string): ethSignature {
    const messageDataBuf =
      typeof messageData === "string"
        ? Buffer.from(messageData.normalize("NFKD"), "utf8")
        : Buffer.from(arrayify(messageData));
    const messageBuf = core.compatibleBufferConcat([Buffer.from(`\x19Ethereum Signed Message:\n${messageDataBuf.length}`, "utf8"), messageDataBuf]);
    return this.signDigest(Isolation.Digest.Algorithms["keccak256"](messageBuf));
  }
  computeSharedSecret(otherKey: BytesLike): string {
    return `0x${this._isolatedKey.ecdh(checkType(SecP256K1.CurvePoint, arrayify(otherKey)))}`;
  }
}

export default SigningKeyAdapter;
