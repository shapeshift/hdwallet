import * as core from "@shapeshiftoss/hdwallet-core";
import * as bech32 from "bech32";
import CryptoJS from "crypto-js";
import * as txBuilder from "tendermint-tx-builder";

import * as Isolation from "./crypto/isolation";
import { NativeHDWalletBase } from "./native";
import * as util from "./util";

export function MixinNativeKavaWalletInfo<TBase extends core.Constructor<core.HDWalletInfo>>(Base: TBase) {
  // eslint-disable-next-line @typescript-eslint/no-shadow
  return class MixinNativeKavaWalletInfo extends Base implements core.KavaWalletInfo {
    readonly _supportsKavaInfo = true;

    async kavaSupportsNetwork(): Promise<boolean> {
      return true;
    }

    async kavaSupportsSecureTransfer(): Promise<boolean> {
      return false;
    }

    kavaSupportsNativeShapeShift(): boolean {
      return false;
    }

    kavaGetAccountPaths(msg: core.KavaGetAccountPaths): Array<core.KavaAccountPath> {
      const slip44 = core.slip44ByCoin("Kava");
      return [
        {
          addressNList: [0x80000000 + 44, 0x80000000 + slip44, 0x80000000 + msg.accountIdx, 0, 0],
        },
      ];
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    kavaNextAccountPath(msg: core.KavaAccountPath): core.KavaAccountPath | undefined {
      // Only support one account for now (like portis).
      return undefined;
    }
  };
}

export function MixinNativeKavaWallet<TBase extends core.Constructor<NativeHDWalletBase>>(Base: TBase) {
  // eslint-disable-next-line @typescript-eslint/no-shadow
  return class MixinNativeKavaWallet extends Base {
    readonly _supportsKava = true;

    #masterKey: Isolation.Core.BIP32.Node | undefined;

    async kavaInitializeWallet(masterKey: Isolation.Core.BIP32.Node): Promise<void> {
      this.#masterKey = masterKey;
    }

    kavaWipe(): void {
      this.#masterKey = undefined;
    }

    kavaBech32ify(address: ArrayLike<number>, prefix: string): string {
      const words = bech32.toWords(address);
      return bech32.encode(prefix, words);
    }

    createKavaAddress(publicKey: string) {
      const message = CryptoJS.SHA256(CryptoJS.enc.Hex.parse(publicKey));
      const hash = CryptoJS.RIPEMD160(message as any).toString();
      const address = Buffer.from(hash, `hex`);
      return this.kavaBech32ify(address, `kava`);
    }

    async kavaGetAddress(msg: core.KavaGetAddress): Promise<string | null> {
      return this.needsMnemonic(!!this.#masterKey, async () => {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const keyPair = await util.getKeyPair(this.#masterKey!, msg.addressNList, "kava");
        return this.createKavaAddress(keyPair.publicKey.toString("hex"));
      });
    }

    async kavaSignTx(msg: core.KavaSignTx): Promise<core.KavaSignedTx | null> {
      return this.needsMnemonic(!!this.#masterKey, async () => {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const keyPair = await util.getKeyPair(this.#masterKey!, msg.addressNList, "kava");
        // @TODO: This needs to be fixed after the change to tendermint serialization
        const adapter = await Isolation.Adapters.Cosmos.create(keyPair);
        const result = await txBuilder.sign(msg.tx, adapter, msg.sequence, msg.account_number, msg.chain_id);
        return txBuilder.createSignedTx(msg.tx, result);
      });
    }
  };
}
