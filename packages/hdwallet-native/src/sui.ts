import * as core from "@shapeshiftoss/hdwallet-core";

import { Isolation } from "./crypto";
import { SuiAdapter } from "./crypto/isolation/adapters/sui";
import { NativeHDWalletBase } from "./native";

export function MixinNativeSuiWalletInfo<TBase extends core.Constructor<core.HDWalletInfo>>(Base: TBase) {
  return class MixinNativeSuiWalletInfo extends Base implements core.SuiWalletInfo {
    readonly _supportsSuiInfo = true;

    suiGetAccountPaths(msg: core.SuiGetAccountPaths): Array<core.SuiAccountPath> {
      return core.suiGetAccountPaths(msg);
    }

    suiNextAccountPath(msg: core.SuiAccountPath): core.SuiAccountPath | undefined {
      throw new Error("Method not implemented");
    }
  };
}

export function MixinNativeSuiWallet<TBase extends core.Constructor<NativeHDWalletBase>>(Base: TBase) {
  return class MixinNativeSuiWallet extends Base {
    readonly _supportsSui = true;

    suiAdapter: SuiAdapter | undefined;

    async suiInitializeWallet(ed25519MasterKey: Isolation.Core.Ed25519.Node): Promise<void> {
      const nodeAdapter = new Isolation.Adapters.Ed25519(ed25519MasterKey);
      this.suiAdapter = new SuiAdapter(nodeAdapter);
    }

    suiWipe() {
      this.suiAdapter = undefined;
    }

    async suiGetAddress(msg: core.SuiGetAddress): Promise<string | null> {
      return this.needsMnemonic(!!this.suiAdapter, () => {
        return this.suiAdapter!.getAddress(msg.addressNList);
      });
    }

    async suiSignTx(msg: core.SuiSignTx): Promise<core.SuiSignedTx | null> {
      return this.needsMnemonic(!!this.suiAdapter, async () => {
        const signature = await this.suiAdapter!.signTransaction(msg.intentMessageBytes, msg.addressNList);
        const publicKey = await this.suiAdapter!.getPublicKey(msg.addressNList);

        return {
          signature,
          publicKey,
        };
      });
    }
  };
}
