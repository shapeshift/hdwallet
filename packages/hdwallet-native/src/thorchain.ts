import * as core from "@shapeshiftoss/hdwallet-core";
import * as txBuilder from "tendermint-tx-builder";
import { NativeHDWalletBase } from "./native";
import { toWords, encode } from "bech32";
import CryptoJS, { RIPEMD160, SHA256 } from "crypto-js";
import util from "./util";
import * as Isolation from "./crypto/isolation";

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
      const slip44 = core.slip44ByCoin("Thorchain")
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

    #seed: Isolation.BIP32.SeedInterface;

    async thorchainInitializeWallet(seed: Isolation.BIP32.SeedInterface): Promise<void> {
      this.#seed = seed;
    }

    thorchainWipe(): void {
      this.#seed = undefined;
    }

    thorchainBech32ify(address: ArrayLike<number>, prefix: string): string {
      const words = toWords(address);
      return encode(prefix, words);
    }

    createThorchainAddress(publicKey: string) {
      const message = SHA256(CryptoJS.enc.Hex.parse(publicKey));
      const hash = RIPEMD160(message as any).toString();
      const address = Buffer.from(hash, `hex`);
      return this.thorchainBech32ify(address, `thor`);
    }

    async thorchainGetAddress(msg: core.ThorchainGetAddress): Promise<string> {
      return this.needsMnemonic(!!this.#seed, async () => {
        return this.createThorchainAddress(util.getKeyPair(this.#seed, msg.addressNList, "thorchain").publicKey.toString("hex"));
      });
    }

    async thorchainSignTx(msg: core.ThorchainSignTx): Promise<core.ThorchainSignedTx> {
      return this.needsMnemonic(!!this.#seed, async () => {
        const keyPair = util.getKeyPair(this.#seed, msg.addressNList, "thorchain");
        const adapter = new Isolation.Adapters.Cosmos(keyPair);
        const result = await txBuilder.sign(msg.tx, adapter, msg.sequence, msg.account_number, THOR_CHAIN);

        return txBuilder.createSignedTx(msg.tx, result);
      });
    }
  };
}
