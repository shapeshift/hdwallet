import * as Isolation from "../";
import { SecP256K1 } from "../core";

export class WalletAdapter {
  protected readonly _isolatedKey: SecP256K1.ECDSAKey | Isolation.Adapters.BIP32;
  readonly _publicKey: SecP256K1.CurvePoint;

  protected constructor(isolatedKey: SecP256K1.ECDSAKey | Isolation.Adapters.BIP32, publicKey: SecP256K1.CurvePoint) {
    this._isolatedKey = isolatedKey;
    this._publicKey = publicKey;
  }

  static async create(isolatedKey: SecP256K1.ECDSAKey | Isolation.Adapters.BIP32): Promise<WalletAdapter> {
    return new WalletAdapter(isolatedKey, await isolatedKey.getPublicKey());
  }

  get publicKey(): string {
    return Buffer.from(this._publicKey).toString("hex");
  }

  async sign(signMessage: string): Promise<Buffer> {
    const signBuf = Buffer.from(signMessage.normalize("NFKD"), "utf8");
    return Buffer.from(await this._isolatedKey.ecdsaSign("sha256", signBuf));
  }
}

export default WalletAdapter;
