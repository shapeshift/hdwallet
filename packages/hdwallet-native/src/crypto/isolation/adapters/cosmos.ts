import { SecP256K1 } from "../core";
import * as Digest from "../core/digest";

type IsolatedKey = SecP256K1.ECDSAKey;
export class WalletAdapter {
    _isolatedKey: IsolatedKey;
    constructor(isolatedKey: IsolatedKey) {
        this._isolatedKey = isolatedKey;
    }
    get publicKey(): string {
        return Buffer.from(this._isolatedKey.publicKey).toString("hex");
    }
    async sign(signMessage: string): Promise<Buffer> {
        const signBuf = Buffer.from(signMessage.normalize("NFKD"), "utf8");
        const signBufHash = Digest.Algorithms["sha256"](signBuf);
        return Buffer.from(await this._isolatedKey.ecdsaSign(signBufHash));
    }
}

export default WalletAdapter;
