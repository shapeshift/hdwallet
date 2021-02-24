import * as core from "@shapeshiftoss/hdwallet-core";
import txBuilder from "cosmos-tx-builder";
import { BIP32Interface } from "bitcoinjs-lib";
import * as bitcoin from "bitcoinjs-lib";
import { NativeHDWalletBase } from "./native";
import { getNetwork } from "./networks";
import { toWords, encode } from "bech32";
import CryptoJS, { RIPEMD160, SHA256 } from "crypto-js";
import util from "./util";
const THOR_CHAIN = "thorchain";

export function MixinNativeThorchainWalletInfo<TBase extends core.Constructor>(Base: TBase) {
  return class MixinNativeThorchainWalletInfo extends Base implements core.ThorchainWalletInfo {
    _supportsThorchainInfo = true;
    async thorchainSupportsNetwork(): Promise<boolean> {
      return true;
    }

    async thorchainSupportsSecureTransfer(): Promise<boolean> {
      return false;
    }

    thorchainSupportsNativeShapeShift(): boolean {
      return false;
    }

    thorchainGetAccountPaths(msg: core.ThorchainGetAccountPaths): Array<core.ThorchainAccountPath> {
      const slip44 = core.slip44ByCoin("Atom")
      return [
        {
          addressNList: [0x80000000 + 44, 0x80000000 + slip44, 0x80000000 + msg.accountIdx, 0, 0],
        },
      ];
    }

    thorchainNextAccountPath(msg: core.ThorchainAccountPath): core.ThorchainAccountPath {
      // Only support one account for now (like portis).
      return undefined;
    }
  };
}

export function MixinNativeThorchainWallet<TBase extends core.Constructor<NativeHDWalletBase>>(Base: TBase) {
  return class MixinNativeThorchainWallet extends Base {
    _supportsThorchain = true;

    #wallet: BIP32Interface;

    async thorchainInitializeWallet(seed: Buffer): Promise<void> {
      const network = getNetwork("thorchain");
      this.#wallet = bitcoin.bip32.fromSeed(seed, network);
    }

    thorchainWipe(): void {
      this.#wallet = undefined;
    }

    bech32ify(address: ArrayLike<number>, prefix: string): string {
      const words = toWords(address);
      return encode(prefix, words);
    }

    createThorchainAddress(publicKey: string) {
      const message = SHA256(CryptoJS.enc.Hex.parse(publicKey));
      const hash = RIPEMD160(message as any).toString();
      const address = Buffer.from(hash, `hex`);
      return this.bech32ify(address, `tthor`);
    }

    async thorchainGetAddress(msg: core.ThorchainGetAddress): Promise<string> {
      return this.needsMnemonic(!!this.#wallet, async () => {
        return this.createThorchainAddress(util.getKeyPair(this.#wallet, msg.addressNList, "thorchain").publicKey);
      });
    }

    async thorchainSignTx(msg: core.ThorchainSignTx): Promise<core.ThorchainSignedTx> {
      return this.needsMnemonic(!!this.#wallet, async () => {
        const keyPair = util.getKeyPair(this.#wallet, msg.addressNList, "thorchain");
        const result = await txBuilder.sign(msg.tx, keyPair, msg.sequence, msg.account_number, THOR_CHAIN);

        return txBuilder.createSignedTx(msg.tx, result);
      });
    }
  };
}
