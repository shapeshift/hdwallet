import * as core from "@shapeshiftoss/hdwallet-core";
import * as bech32 from "bech32";
import CryptoJS from "crypto-js";
import * as txBuilder from "tendermint-tx-builder";

import * as Isolation from "./crypto/isolation";
import { NativeHDWalletBase } from "./native";
import * as util from "./util";

export function MixinNativeSecretWalletInfo<TBase extends core.Constructor<core.HDWalletInfo>>(Base: TBase) {
  // eslint-disable-next-line @typescript-eslint/no-shadow
  return class MixinNativeSecretWalletInfo extends Base implements core.SecretWalletInfo {
    readonly _supportsSecretInfo = true;
    async secretSupportsNetwork(): Promise<boolean> {
      return true;
    }

    async secretSupportsSecureTransfer(): Promise<boolean> {
      return false;
    }

    secretSupportsNativeShapeShift(): boolean {
      return false;
    }

    secretGetAccountPaths(msg: core.SecretGetAccountPaths): Array<core.SecretAccountPath> {
      const slip44 = core.slip44ByCoin("Secret");
      return [
        {
          addressNList: [0x80000000 + 44, 0x80000000 + slip44, 0x80000000 + msg.accountIdx, 0, 0],
        },
      ];
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    secretNextAccountPath(msg: core.SecretAccountPath): core.SecretAccountPath | undefined {
      // Only support one account for now (like portis).
      return undefined;
    }
  };
}

export function MixinNativeSecretWallet<TBase extends core.Constructor<NativeHDWalletBase>>(Base: TBase) {
  // eslint-disable-next-line @typescript-eslint/no-shadow
  return class MixinNativeSecretWallet extends Base {
    readonly _supportsSecret = true;

    #masterKey: Isolation.Core.BIP32.Node | undefined;

    async secretInitializeWallet(masterKey: Isolation.Core.BIP32.Node): Promise<void> {
      this.#masterKey = masterKey;
    }

    secretWipe(): void {
      this.#masterKey = undefined;
    }

    secretBech32ify(address: ArrayLike<number>, prefix: string): string {
      const words = bech32.toWords(address);
      return bech32.encode(prefix, words);
    }

    createSecretAddress(publicKey: string) {
      const message = CryptoJS.SHA256(CryptoJS.enc.Hex.parse(publicKey));
      const hash = CryptoJS.RIPEMD160(message as any).toString();
      const address = Buffer.from(hash, `hex`);
      return this.secretBech32ify(address, `secret`);
    }

    async secretGetAddress(msg: core.SecretGetAddress): Promise<string | null> {
      return this.needsMnemonic(!!this.#masterKey, async () => {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const keyPair = await util.getKeyPair(this.#masterKey!, msg.addressNList, "secret");
        return this.createSecretAddress(keyPair.publicKey.toString("hex"));
      });
    }

    async secretSignTx(msg: core.SecretSignTx): Promise<any | null> {
      return this.needsMnemonic(!!this.#masterKey, async () => {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const keyPair = await util.getKeyPair(this.#masterKey!, msg.addressNList, "secret");
        // @TODO: This needs to be fixed after the change to tendermint serialization
        const adapter = await Isolation.Adapters.Cosmos.create(keyPair);
        const result = await txBuilder.sign(
          msg.tx,
          adapter,
          String(msg.sequence),
          String(msg.account_number),
          msg.chain_id
        );
        return txBuilder.createSignedTx(msg.tx, result);
      });
    }
  };
}
