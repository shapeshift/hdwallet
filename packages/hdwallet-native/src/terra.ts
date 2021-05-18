import * as core from "@shapeshiftoss/hdwallet-core";
import * as txBuilder from "tendermint-tx-builder";
import { NativeHDWalletBase } from "./native";
import { toWords, encode } from "bech32";
import CryptoJS, { RIPEMD160, SHA256 } from "crypto-js";
import util from "./util";
import * as Isolation from "./crypto/isolation";

export function MixinNativeTerraWalletInfo<TBase extends core.Constructor>(Base: TBase) {
  return class MixinNativeTerraWalletInfo extends Base implements core.TerraWalletInfo {
    _supportsTerraInfo = true;
    async terraSupportsNetwork(): Promise<boolean> {
      return true;
    }

    async terraSupportsSecureTransfer(): Promise<boolean> {
      return false;
    }

    terraSupportsNativeShapeShift(): boolean {
      return false;
    }

    terraGetAccountPaths(msg: core.TerraGetAccountPaths): Array<core.TerraAccountPath> {
      const slip44 = core.slip44ByCoin("Terra")
      return [
        {
          addressNList: [0x80000000 + 44, 0x80000000 + slip44, 0x80000000 + msg.accountIdx, 0, 0],
        },
      ];
    }

    terraNextAccountPath(msg: core.TerraAccountPath): core.TerraAccountPath {
      // Only support one account for now (like portis).
      return undefined;
    }
  };
}

export function MixinNativeTerraWallet<TBase extends core.Constructor<NativeHDWalletBase>>(Base: TBase) {
  return class MixinNativeTerraWallet extends Base {
    _supportsTerra = true;

    #seed: Isolation.BIP32.SeedInterface;

    async terraInitializeWallet(seed: Isolation.BIP32.SeedInterface): Promise<void> {
      this.#seed = seed;
    }

    terraWipe(): void {
      this.#seed = undefined;
    }

    terraBech32ify(address: ArrayLike<number>, prefix: string): string {
      const words = toWords(address);
      return encode(prefix, words);
    }

    createTerraAddress(publicKey: string) {
      const message = SHA256(CryptoJS.enc.Hex.parse(publicKey));
      const hash = RIPEMD160(message as any).toString();
      const address = Buffer.from(hash, `hex`);
      return this.terraBech32ify(address, `terra`);
    }

    async terraGetAddress(msg: core.TerraGetAddress): Promise<string> {
      return this.needsMnemonic(!!this.#seed, async () => {
        return this.createTerraAddress(util.getKeyPair(this.#seed, msg.addressNList, "terra").publicKey.toString("hex"));
      });
    }

    async terraSignTx(msg: core.TerraSignTx): Promise<any> {
      return this.needsMnemonic(!!this.#seed, async () => {
        const keyPair = util.getKeyPair(this.#seed, msg.addressNList, "terra");
        const adapter = new Isolation.Adapters.Cosmos(keyPair);
        const result = await txBuilder.sign(msg.tx, adapter, msg.sequence, msg.account_number, "terra");
        const resultFinal = await txBuilder.createSignedTx(msg.tx, result);
        return resultFinal
      });
    }
  };
}
