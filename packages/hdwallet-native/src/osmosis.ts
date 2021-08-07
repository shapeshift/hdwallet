import * as core from "@shapeshiftoss/hdwallet-core";
import * as bech32 from "bech32";
import CryptoJS from "crypto-js";
import * as txBuilder from "tendermint-tx-builder";

import { NativeHDWalletBase } from "./native";
import util from "./util";
import * as Isolation from "./crypto/isolation";

const OSMOSIS_CHAIN = "osmosis-1";

export function MixinNativeOsmosisWalletInfo<TBase extends core.Constructor<core.HDWalletInfo>>(Base: TBase) {
  return class MixinNativeOsmosisWalletInfo extends Base implements core.OsmosisWalletInfo {
    readonly _supportsOsmosisInfo = true;
    async osmosisSupportsNetwork(): Promise<boolean> {
      return true;
    }

    async osmosisSupportsSecureTransfer(): Promise<boolean> {
      return false;
    }

    osmosisSupportsNativeShapeShift(): boolean {
      return false;
    }

    osmosisGetAccountPaths(msg: core.OsmosisGetAccountPaths): Array<core.OsmosisAccountPath> {
      const slip44 = core.slip44ByCoin("Osmo")
      return [
        {
          addressNList: [0x80000000 + 44, 0x80000000 + slip44, 0x80000000 + msg.accountIdx, 0, 0],
        },
      ];
    }

    osmosisNextAccountPath(msg: core.OsmosisAccountPath): core.OsmosisAccountPath | undefined {
      // Only support one account for now (like portis).
      return undefined;
    }
  };
}

export function MixinNativeOsmosisWallet<TBase extends core.Constructor<NativeHDWalletBase>>(Base: TBase) {
  return class MixinNativeOsmosisWallet extends Base {
    readonly _supportsOsmosis = true;

    #seed: Isolation.Core.BIP32.Seed | undefined;

    async osmosisInitializeWallet(seed: Isolation.Core.BIP32.Seed): Promise<void> {
      this.#seed = seed;
    }

    osmosisWipe(): void {
      this.#seed = undefined;
    }

    osmosisBech32ify(address: ArrayLike<number>, prefix: string): string {
      const words = bech32.toWords(address);
      return bech32.encode(prefix, words);
    }

    createOsmosisAddress(publicKey: string) {
      const message = CryptoJS.SHA256(CryptoJS.enc.Hex.parse(publicKey));
      const hash = CryptoJS.RIPEMD160(message as any).toString();
      const address = Buffer.from(hash, `hex`);
      return this.osmosisBech32ify(address, `osmosis`);
    }

    async osmosisGetAddress(msg: core.OsmosisGetAddress): Promise<string | null> {
      return this.needsMnemonic(!!this.#seed, async () => {
        return this.createOsmosisAddress(util.getKeyPair(this.#seed!, msg.addressNList, "osmosis").publicKey.toString("hex"));
      });
    }

    async osmosisSignTx(msg: core.OsmosisSignTx): Promise<core.OsmosisSignedTx | null> {
      return this.needsMnemonic(!!this.#seed, async () => {
        const keyPair = util.getKeyPair(this.#seed!, msg.addressNList, "osmosis");
        const adapter = new Isolation.Adapters.Cosmos(keyPair);
        const result = await txBuilder.sign(msg.tx, adapter, msg.sequence, msg.account_number, OSMOSIS_CHAIN);

        return txBuilder.createSignedTx(msg.tx, result);
      });
    }
  };
}
