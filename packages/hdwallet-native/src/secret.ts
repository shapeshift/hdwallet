import * as core from "@shapeshiftoss/hdwallet-core";
import txBuilder from "cosmos-tx-builder";
import { BIP32Interface } from "bitcoinjs-lib";
import * as bitcoin from "bitcoinjs-lib";
import { NativeHDWalletBase } from "./native";
import { getNetwork } from "./networks";
import { toWords, encode } from "bech32";
import CryptoJS, { RIPEMD160, SHA256 } from "crypto-js";
import util from "./util";
const THOR_CHAIN = "secret";

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

    #wallet: BIP32Interface;

    async secretInitializeWallet(seed: Buffer): Promise<void> {
      const network = getNetwork("secret");
      this.#wallet = bitcoin.bip32.fromSeed(seed, network);
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
      return this.bech32ify(address, `tthor`);
    }

    async secretGetAddress(msg: core.SecretGetAddress): Promise<string> {
      return this.needsMnemonic(!!this.#wallet, async () => {
        return this.createSecretAddress(util.getKeyPair(this.#wallet, msg.addressNList, "secret").publicKey);
      });
    }

    async secretSignTx(msg: core.SecretSignTx): Promise<core.SecretSignedTx> {
      return this.needsMnemonic(!!this.#wallet, async () => {
        const keyPair = util.getKeyPair(this.#wallet, msg.addressNList, "secret");
        const result = await txBuilder.sign(msg.tx, keyPair, msg.sequence, msg.account_number, THOR_CHAIN);

        return txBuilder.createSignedTx(msg.tx, result);
      });
    }
  };
}
