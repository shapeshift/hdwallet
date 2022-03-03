import * as core from "@shapeshiftoss/hdwallet-core";
import * as bech32 from "bech32";
import CryptoJS from "crypto-js";
import * as protoTxBuilder from "@shapeshiftoss/proto-tx-builder";

import { NativeHDWalletBase } from "./native";
import * as util from "./util";
import * as Isolation from "./crypto/isolation";
import {CosmosSignedTx} from "@shapeshiftoss/hdwallet-core";

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

    #masterKey: Isolation.Core.BIP32.Node | undefined;

    async osmosisInitializeWallet(masterKey: Isolation.Core.BIP32.Node): Promise<void> {
      this.#masterKey = masterKey;
    }

    osmosisWipe(): void {
      this.#masterKey = undefined;
    }

    osmosisBech32ify(address: ArrayLike<number>, prefix: string): string {
      const words = bech32.toWords(address);
      return bech32.encode(prefix, words);
    }

    createOsmosisAddress(publicKey: string) {
      const message = CryptoJS.SHA256(CryptoJS.enc.Hex.parse(publicKey));
      const hash = CryptoJS.RIPEMD160(message as any).toString();
      const address = Buffer.from(hash, `hex`);
      return this.osmosisBech32ify(address, `osmo`);
    }

    async osmosisGetAddress(msg: core.OsmosisGetAddress): Promise<string | null> {
      return this.needsMnemonic(!!this.#masterKey, async () => {
        const keyPair = await util.getKeyPair(this.#masterKey!, msg.addressNList, "osmosis");
        return this.createOsmosisAddress(keyPair.publicKey.toString("hex"));
      });
    }

    async osmosisSignTx(msg: core.OsmosisSignTx): Promise<core.CosmosSignedTx | null> {
      return this.needsMnemonic(!!this.#masterKey, async () => {
        const keyPair = await util.getKeyPair(this.#masterKey!, msg.addressNList, "osmosis");
        const adapter = await Isolation.Adapters.CosmosDirect.create(keyPair.node, "osmo");
        return await protoTxBuilder.sign(msg.tx, adapter, msg.sequence, msg.account_number, OSMOSIS_CHAIN);
      });
    }
  };
}
