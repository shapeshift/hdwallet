import * as core from "@shapeshiftoss/hdwallet-core";
import * as bitcoin from "bitcoinjs-lib";
import { NativeHDWalletBase } from "./native";
import { getNetwork } from "./networks";
import { toWords, encode } from "bech32";
import CryptoJS, { RIPEMD160, SHA256 } from "crypto-js";
import util from "./util";

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

    #wallet: bitcoin.BIP32Interface;
    #seed: string;

    async secretInitializeWallet(seed: Buffer): Promise<void> {
      const network = getNetwork("secret");
      this.#wallet = bitcoin.bip32.fromSeed(seed, network);
    }

    secretSetMnemonic(mnemonic: string): void {
      this.#seed = mnemonic
    }

    secretWipe(): void {
      this.#wallet = undefined;
    }

    bech32ify(address: ArrayLike<number>, prefix: string): string {
      const words = toWords(address);
      return encode(prefix, words);
    }

    createSecretAddress(publicKey: string) {
      const message = SHA256(CryptoJS.enc.Hex.parse(publicKey));
      const hash = RIPEMD160(message as any).toString();
      const address = Buffer.from(hash, `hex`);
      return this.bech32ify(address, `secret`);
    }

    async secretGetAddress(msg: core.SecretGetAddress): Promise<string> {
      return this.needsMnemonic(!!this.#wallet, async () => {
        return this.createSecretAddress(util.getKeyPair(this.#wallet, msg.addressNList, "secret").publicKey);
      });
    }

    async secretSignTx(msg: core.SecretSignTx): Promise<any> {
      return this.needsMnemonic(!!this.#wallet, async () => {
        return null;
      });
    }
  };
}
