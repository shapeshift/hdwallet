import { ExternalPrivateKey as FIOExternalPrivateKey } from "@shapeshiftoss/fiojs";
import * as core from "@shapeshiftoss/hdwallet-core";
import bs58 from "bs58";

import { SecP256K1 } from "../core";
import * as Digest from "../core/digest";
import { CurvePoint, RecoverableSignature } from "../core/secp256k1";
import { checkType } from "../types";

function bs58FioEncode(raw: Uint8Array, keyType = ""): string {
  const typeBuf = Buffer.from(keyType, "utf8");
  const checksum = Digest.Algorithms["ripemd160"](core.compatibleBufferConcat([raw, typeBuf])).slice(0, 4);
  return bs58.encode(core.compatibleBufferConcat([raw, checksum]));
}

type IsolatedKey = SecP256K1.ECDSAKey & SecP256K1.ECDHKey;
export class ExternalSignerAdapter implements FIOExternalPrivateKey {
  protected readonly _isolatedKey: IsolatedKey;
  readonly _publicKey: CurvePoint;

  protected constructor(isolatedKey: IsolatedKey, publicKey: CurvePoint) {
    this._isolatedKey = isolatedKey;
    this._publicKey = publicKey;
  }

  static async create(isolatedKey: IsolatedKey): Promise<ExternalSignerAdapter> {
    return new ExternalSignerAdapter(isolatedKey, await isolatedKey.getPublicKey());
  }

  get publicKey(): string {
    const raw = SecP256K1.CompressedPoint.from(this._publicKey);
    return `FIO${bs58FioEncode(raw)}`;
  }

  async sign(signBuf: Uint8Array): Promise<string> {
    const sig = await SecP256K1.RecoverableSignature.signCanonically(this._isolatedKey, "sha256", signBuf);
    const fioSigBuf = core.compatibleBufferConcat([
      Buffer.from([RecoverableSignature.recoveryParam(sig) + 4 + 27]),
      SecP256K1.RecoverableSignature.r(sig),
      SecP256K1.RecoverableSignature.s(sig),
    ]);
    return `SIG_K1_${bs58FioEncode(fioSigBuf, "K1")}`;
  }

  async getSharedSecret(publicKey: any): Promise<Buffer> {
    return Buffer.from(
      Digest.Algorithms["sha512"](await this._isolatedKey.ecdh(checkType(SecP256K1.CurvePoint, publicKey.toBuffer())))
    );
  }
}

export default ExternalSignerAdapter;
