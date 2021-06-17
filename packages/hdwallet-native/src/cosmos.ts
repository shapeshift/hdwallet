import * as core from "@shapeshiftoss/hdwallet-core";
import * as bech32 from "bech32";
import CryptoJS from "crypto-js";
import * as txBuilder from "tendermint-tx-builder";

import { NativeHDWalletBase } from "./native";
import util from "./util";
import * as Isolation from "./crypto/isolation";

const ATOM_CHAIN = "cosmoshub-4";

export function MixinNativeCosmosWalletInfo<TBase extends core.Constructor<core.HDWalletInfo>>(Base: TBase) {
  return class MixinNativeCosmosWalletInfo extends Base implements core.CosmosWalletInfo {
    readonly _supportsCosmosInfo = true;
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

    cosmosNextAccountPath(msg: core.CosmosAccountPath): core.CosmosAccountPath | undefined {
      // Only support one account for now (like portis).
      return undefined;
    }
  };
}

export function MixinNativeCosmosWallet<TBase extends core.Constructor<NativeHDWalletBase>>(Base: TBase) {
  return class MixinNativeCosmosWallet extends Base {
    readonly _supportsCosmos = true;

    #seed: Isolation.Core.BIP32.Seed | undefined;

    async cosmosInitializeWallet(seed: Isolation.Core.BIP32.Seed): Promise<void> {
      this.#seed = seed;
    }

    cosmosWipe(): void {
      this.#seed = undefined;
    }

    cosmosBech32ify(address: ArrayLike<number>, prefix: string): string {
      const words = bech32.toWords(address);
      return bech32.encode(prefix, words);
    }

    createCosmosAddress(publicKey: string) {
      const message = CryptoJS.SHA256(CryptoJS.enc.Hex.parse(publicKey));
      const hash = CryptoJS.RIPEMD160(message as any).toString();
      const address = Buffer.from(hash, `hex`);
      return this.cosmosBech32ify(address, `cosmos`);
    }

    async cosmosGetAddress(msg: core.CosmosGetAddress): Promise<string | null> {
      return this.needsMnemonic(!!this.#seed, async () => {
        return this.createCosmosAddress(util.getKeyPair(this.#seed!, msg.addressNList, "cosmos").publicKey.toString("hex"));
      });
    }

    async cosmosSignTx(msg: core.CosmosSignTx): Promise<core.CosmosSignedTx | null> {
      return this.needsMnemonic(!!this.#seed, async () => {
        const keyPair = util.getKeyPair(this.#seed!, msg.addressNList, "cosmos");
        const adapter = new Isolation.Adapters.Cosmos(keyPair);
        const result = await txBuilder.sign(msg.tx, adapter, msg.sequence, msg.account_number, ATOM_CHAIN);

        return txBuilder.createSignedTx(msg.tx, result);
      });
    }
  };
}
