import * as core from "@shapeshiftoss/hdwallet-core";
import * as txBuilder from "tendermint-tx-builder";
import { NativeHDWalletBase } from "./native";
import { toWords, encode } from "bech32";
import CryptoJS, { RIPEMD160, SHA256 } from "crypto-js";
import util from "./util";
import * as Isolation from "./crypto/isolation";

const ATOM_CHAIN = "cosmoshub-4";

export function MixinNativeCosmosWalletInfo<TBase extends core.Constructor>(Base: TBase) {
  return class MixinNativeCosmosWalletInfo extends Base implements core.CosmosWalletInfo {
    _supportsCosmosInfo = true;
    async cosmosSupportsNetwork(): Promise<boolean> {
      return true;
    }

    async cosmosSupportsSecureTransfer(): Promise<boolean> {
      return false;
    }

    cosmosSupportsNativeShapeShift(): boolean {
      return false;
    }

    cosmosGetAccountPaths(msg: core.CosmosGetAccountPaths): Array<core.CosmosAccountPath> {
      const slip44 = core.slip44ByCoin("Atom")
      return [
        {
          addressNList: [0x80000000 + 44, 0x80000000 + slip44, 0x80000000 + msg.accountIdx, 0, 0],
        },
      ];
    }

    cosmosNextAccountPath(msg: core.CosmosAccountPath): core.CosmosAccountPath {
      // Only support one account for now (like portis).
      return undefined;
    }
  };
}

export function MixinNativeCosmosWallet<TBase extends core.Constructor<NativeHDWalletBase>>(Base: TBase) {
  return class MixinNativeCosmosWallet extends Base {
    _supportsCosmos = true;

    #seed: Isolation.BIP32.SeedInterface;

    async cosmosInitializeWallet(seed: Isolation.BIP32.SeedInterface): Promise<void> {
      this.#seed = seed;
    }

    cosmosWipe(): void {
      this.#seed = undefined;
    }

    cosmosBech32ify(address: ArrayLike<number>, prefix: string): string {
      const words = toWords(address);
      return encode(prefix, words);
    }

    createCosmosAddress(publicKey: string) {
      const message = SHA256(CryptoJS.enc.Hex.parse(publicKey));
      const hash = RIPEMD160(message as any).toString();
      const address = Buffer.from(hash, `hex`);
      return this.cosmosBech32ify(address, `cosmos`);
    }

    async cosmosGetAddress(msg: core.CosmosGetAddress): Promise<string> {
      return this.needsMnemonic(!!this.#seed, async () => {
        return this.createCosmosAddress(util.getKeyPair(this.#seed, msg.addressNList, "cosmos").publicKey.toString("hex"));
      });
    }

    async cosmosSignTx(msg: core.CosmosSignTx): Promise<core.CosmosSignedTx> {
      return this.needsMnemonic(!!this.#seed, async () => {
        const keyPair = util.getKeyPair(this.#seed, msg.addressNList, "cosmos");
        const adapter = new Isolation.Adapters.Cosmos(keyPair);
        const result = await txBuilder.sign(msg.tx, adapter, msg.sequence, msg.account_number, ATOM_CHAIN);

        return txBuilder.createSignedTx(msg.tx, result);
      });
    }
  };
}
