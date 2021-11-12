import * as core from "@shapeshiftoss/hdwallet-core";
import * as bech32 from "bech32";
import CryptoJS from "crypto-js";
import * as txBuilder from "tendermint-tx-builder";

import { NativeHDWalletBase } from "./native";
import * as util from "./util";
import * as Isolation from "./crypto/isolation";

export function MixinNativeTerraWalletInfo<TBase extends core.Constructor<core.HDWalletInfo>>(Base: TBase) {
  return class MixinNativeTerraWalletInfo extends Base implements core.TerraWalletInfo {
    readonly _supportsTerraInfo = true;

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

    terraNextAccountPath(msg: core.TerraAccountPath): core.TerraAccountPath | undefined {
      // Only support one account for now (like portis).
      return undefined;
    }
  };
}

export function MixinNativeTerraWallet<TBase extends core.Constructor<NativeHDWalletBase>>(Base: TBase) {
  return class MixinNativeTerraWallet extends Base {
    readonly _supportsTerra = true;

    #masterKey: Isolation.Core.BIP32.Node | undefined;

    async terraInitializeWallet(masterKey: Isolation.Core.BIP32.Node): Promise<void> {
      this.#masterKey = masterKey;
    }

    terraWipe(): void {
      this.#masterKey = undefined;
    }

    terraBech32ify(address: ArrayLike<number>, prefix: string): string {
      const words = bech32.toWords(address);
      return bech32.encode(prefix, words);
    }

    createTerraAddress(publicKey: string) {
      const message = CryptoJS.SHA256(CryptoJS.enc.Hex.parse(publicKey));
      const hash = CryptoJS.RIPEMD160(message as any).toString();
      const address = Buffer.from(hash, `hex`);
      return this.terraBech32ify(address, `terra`);
    }

    async terraGetAddress(msg: core.TerraGetAddress): Promise<string | null> {
      return this.needsMnemonic(!!this.#masterKey, async () => {
        const keyPair = await util.getKeyPair(this.#masterKey!, msg.addressNList, "terra");
        return this.createTerraAddress(keyPair.publicKey.toString("hex"));
      });
    }

    async terraSignTx(msg: core.TerraSignTx): Promise<any | null> {
      return this.needsMnemonic(!!this.#masterKey, async () => {
        const keyPair = await util.getKeyPair(this.#masterKey!, msg.addressNList, "terra");
        const adapter = await Isolation.Adapters.Cosmos.create(keyPair);
        const result = await txBuilder.sign(msg.tx, adapter, msg.sequence, msg.account_number, "terra");
        return txBuilder.createSignedTx(msg.tx, result);
      });
    }
  };
}
