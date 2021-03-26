import * as core from "@shapeshiftoss/hdwallet-core";
import txBuilder from "cosmos-tx-builder";
import { BIP32Interface } from "bitcoinjs-lib";
import * as bitcoin from "bitcoinjs-lib";
import { NativeHDWalletBase } from "./native";
import { getNetwork } from "./networks";
import { toWords, encode } from "bech32";
import CryptoJS, { RIPEMD160, SHA256 } from "crypto-js";
import util from "./util";
const THOR_CHAIN = "cardano";

export function MixinNativeCardanoWalletInfo<TBase extends core.Constructor>(Base: TBase) {
  return class MixinNativeCardanoWalletInfo extends Base implements core.CardanoWalletInfo {
    _supportsCardanoInfo = true;
    async cardanoSupportsNetwork(): Promise<boolean> {
      return true;
    }

    async cardanoSupportsSecureTransfer(): Promise<boolean> {
      return false;
    }

    cardanoSupportsNativeShapeShift(): boolean {
      return false;
    }

    cardanoGetAccountPaths(msg: core.CardanoGetAccountPaths): Array<core.CardanoAccountPath> {
      const slip44 = core.slip44ByCoin("Cardano")
      return [
        {
          addressNList: [0x80000000 + 44, 0x80000000 + slip44, 0x80000000 + msg.accountIdx, 0, 0],
        },
      ];
    }

    cardanoNextAccountPath(msg: core.CardanoAccountPath): core.CardanoAccountPath {
      // Only support one account for now (like portis).
      return undefined;
    }
  };
}

export function MixinNativeCardanoWallet<TBase extends core.Constructor<NativeHDWalletBase>>(Base: TBase) {
  return class MixinNativeCardanoWallet extends Base {
    _supportsCardano = true;

    #wallet: BIP32Interface;

    async cardanoInitializeWallet(seed: Buffer): Promise<void> {
      const network = getNetwork("cardano");
      this.#wallet = bitcoin.bip32.fromSeed(seed, network);
    }

    cardanoWipe(): void {
      this.#wallet = undefined;
    }

    bech32ify(address: ArrayLike<number>, prefix: string): string {
      const words = toWords(address);
      return encode(prefix, words);
    }

    createCardanoAddress(publicKey: string) {
      const message = SHA256(CryptoJS.enc.Hex.parse(publicKey));
      const hash = RIPEMD160(message as any).toString();
      const address = Buffer.from(hash, `hex`);
      return this.bech32ify(address, `tthor`);
    }

    async cardanoGetAddress(msg: core.CardanoGetAddress): Promise<string> {
      return this.needsMnemonic(!!this.#wallet, async () => {
        return this.createCardanoAddress(util.getKeyPair(this.#wallet, msg.addressNList, "cardano").publicKey);
      });
    }

    async cardanoSignTx(msg: core.CardanoSignTx): Promise<core.CardanoSignedTx> {
      return this.needsMnemonic(!!this.#wallet, async () => {
        const keyPair = util.getKeyPair(this.#wallet, msg.addressNList, "cardano");
        const result = await txBuilder.sign(msg.tx, keyPair, msg.sequence, msg.account_number, THOR_CHAIN);

        return txBuilder.createSignedTx(msg.tx, result);
      });
    }
  };
}
