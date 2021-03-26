import * as core from "@shapeshiftoss/hdwallet-core";
import txBuilder from "cosmos-tx-builder";
import { BIP32Interface } from "bitcoinjs-lib";
import * as bitcoin from "bitcoinjs-lib";
import { NativeHDWalletBase } from "./native";
import { getNetwork } from "./networks";
import { toWords, encode } from "bech32";
import CryptoJS, { RIPEMD160, SHA256 } from "crypto-js";
import util from "./util";
const THOR_CHAIN = "terra";

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

    #wallet: BIP32Interface;

    async terraInitializeWallet(seed: Buffer): Promise<void> {
      const network = getNetwork("terra");
      this.#wallet = bitcoin.bip32.fromSeed(seed, network);
    }

    terraWipe(): void {
      this.#wallet = undefined;
    }

    bech32ify(address: ArrayLike<number>, prefix: string): string {
      const words = toWords(address);
      return encode(prefix, words);
    }

    createTerraAddress(publicKey: string) {
      const message = SHA256(CryptoJS.enc.Hex.parse(publicKey));
      const hash = RIPEMD160(message as any).toString();
      const address = Buffer.from(hash, `hex`);
      return this.bech32ify(address, `terra`);
    }

    async terraGetAddress(msg: core.TerraGetAddress): Promise<string> {
      return this.needsMnemonic(!!this.#wallet, async () => {
        return this.createTerraAddress(util.getKeyPair(this.#wallet, msg.addressNList, "terra").publicKey);
      });
    }

    async terraSignTx(msg: core.TerraSignTx): Promise<core.TerraSignedTx> {
      return this.needsMnemonic(!!this.#wallet, async () => {
        const keyPair = util.getKeyPair(this.#wallet, msg.addressNList, "terra");
        const result = await txBuilder.sign(msg.tx, keyPair, msg.sequence, msg.account_number, THOR_CHAIN);

        return txBuilder.createSignedTx(msg.tx, result);
      });
    }
  };
}
