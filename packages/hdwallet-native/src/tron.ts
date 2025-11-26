import * as core from "@shapeshiftoss/hdwallet-core";

import { Isolation } from "./crypto";
import { TronAdapter } from "./crypto/isolation/adapters/tron";
import { NativeHDWalletBase } from "./native";

export function MixinNativeTronWalletInfo<TBase extends core.Constructor<core.HDWalletInfo>>(Base: TBase) {
  // eslint-disable-next-line @typescript-eslint/no-shadow
  return class MixinNativeTronWalletInfo extends Base implements core.TronWalletInfo {
    readonly _supportsTronInfo = true;

    tronGetAccountPaths(msg: core.TronGetAccountPaths): Array<core.TronAccountPath> {
      return core.tronGetAccountPaths(msg);
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    tronNextAccountPath(msg: core.TronAccountPath): core.TronAccountPath | undefined {
      throw new Error("Method not implemented");
    }
  };
}

export function MixinNativeTronWallet<TBase extends core.Constructor<NativeHDWalletBase>>(Base: TBase) {
  // eslint-disable-next-line @typescript-eslint/no-shadow
  return class MixinNativeTronWallet extends Base {
    readonly _supportsTron = true;

    adapter: TronAdapter | undefined;

    async tronInitializeWallet(masterKey: Isolation.Core.BIP32.Node): Promise<void> {
      const nodeAdapter = new Isolation.Adapters.BIP32(masterKey, "secp256k1");
      this.adapter = new TronAdapter(nodeAdapter);
    }

    tronWipe() {
      this.adapter = undefined;
    }

    async tronGetAddress(msg: core.TronGetAddress): Promise<string | null> {
      return this.needsMnemonic(!!this.adapter, () => {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        return this.adapter!.getAddress(msg.addressNList);
      });
    }

    async tronSignTx(msg: core.TronSignTx): Promise<core.TronSignedTx | null> {
      return this.needsMnemonic(!!this.adapter, async () => {
        const address = await this.tronGetAddress({
          addressNList: msg.addressNList,
          showDisplay: false,
        });

        if (!address) throw new Error("Failed to get TRON address");

        const signature = await this.adapter!.signTransaction(msg.rawDataHex, msg.addressNList);

        // Serialized transaction = rawDataHex + signature
        const serialized = msg.rawDataHex + signature;

        return {
          serialized,
          signature,
        };
      });
    }
  };
}
