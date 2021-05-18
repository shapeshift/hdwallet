import * as core from "@shapeshiftoss/hdwallet-core";
import { NativeHDWalletBase } from "./native";
import * as txBuilder from "tendermint-tx-builder";
import { toWords, encode } from "bech32";
import CryptoJS, { RIPEMD160, SHA256 } from "crypto-js";
import util from "./util";
import * as Isolation from "./crypto/isolation";

export function MixinNativeSecretWalletInfo<TBase extends core.Constructor>(Base: TBase) {
  return class MixinNativeSecretWalletInfo extends Base implements core.SecretWalletInfo {
    _supportsSecretInfo = true;
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
      const slip44 = core.slip44ByCoin("Secret")
      return [
        {
          addressNList: [0x80000000 + 44, 0x80000000 + slip44, 0x80000000 + msg.accountIdx, 0, 0],
        },
      ];
    }

    secretNextAccountPath(msg: core.SecretAccountPath): core.SecretAccountPath {
      // Only support one account for now (like portis).
      return undefined;
    }
  };
}

export function MixinNativeSecretWallet<TBase extends core.Constructor<NativeHDWalletBase>>(Base: TBase) {
  return class MixinNativeSecretWallet extends Base {
    _supportsSecret = true;

    #seed: Isolation.BIP32.SeedInterface;

    async secretInitializeWallet(seed: Isolation.BIP32.SeedInterface): Promise<void> {
      this.#seed = seed;
    }

    secretWipe(): void {
      this.#seed = undefined;
    }

    secretBech32ify(address: ArrayLike<number>, prefix: string): string {
      const words = toWords(address);
      return encode(prefix, words);
    }

    createSecretAddress(publicKey: string) {
      const message = SHA256(CryptoJS.enc.Hex.parse(publicKey));
      const hash = RIPEMD160(message as any).toString();
      const address = Buffer.from(hash, `hex`);
      return this.secretBech32ify(address, `secret`);
    }

    async secretGetAddress(msg: core.SecretGetAddress): Promise<string> {
      return this.needsMnemonic(!!this.#seed, async () => {
        return this.createSecretAddress(util.getKeyPair(this.#seed, msg.addressNList, "secret").publicKey.toString("hex"));
      });
    }

    async secretSignTx(msg: core.SecretSignTx): Promise<any> {
      return this.needsMnemonic(!!this.#seed, async () => {
        const keyPair = util.getKeyPair(this.#seed, msg.addressNList, "secret");
        const adapter = new Isolation.Adapters.Cosmos(keyPair);
        const result = await txBuilder.sign(msg.tx, adapter, String(msg.sequence), String(msg.account_number), "secret");

        return txBuilder.createSignedTx(msg.tx, result);
      });
    }
  };
}
