import * as core from "@shapeshiftoss/hdwallet-core";

import { Isolation } from "./crypto";
import { NearAdapter } from "./crypto/isolation/adapters/near";
import { NativeHDWalletBase } from "./native";

export function MixinNativeNearWalletInfo<TBase extends core.Constructor<core.HDWalletInfo>>(Base: TBase) {
  // eslint-disable-next-line @typescript-eslint/no-shadow
  return class MixinNativeNearWalletInfo extends Base implements core.NearWalletInfo {
    readonly _supportsNearInfo = true;

    nearGetAccountPaths(msg: core.NearGetAccountPaths): Array<core.NearAccountPath> {
      return core.nearGetAccountPaths(msg);
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    nearNextAccountPath(_msg: core.NearAccountPath): core.NearAccountPath | undefined {
      throw new Error("Method not implemented");
    }
  };
}

export function MixinNativeNearWallet<TBase extends core.Constructor<NativeHDWalletBase>>(Base: TBase) {
  // eslint-disable-next-line @typescript-eslint/no-shadow
  return class MixinNativeNearWallet extends Base {
    readonly _supportsNear = true;

    nearAdapter: NearAdapter | undefined;

    async nearInitializeWallet(ed25519MasterKey: Isolation.Core.Ed25519.Node): Promise<void> {
      const nodeAdapter = new Isolation.Adapters.Ed25519(ed25519MasterKey);
      this.nearAdapter = new NearAdapter(nodeAdapter);
    }

    nearWipe() {
      this.nearAdapter = undefined;
    }

    async nearGetAddress(msg: core.NearGetAddress): Promise<string | null> {
      return this.needsMnemonic(!!this.nearAdapter, () => {
        return this.nearAdapter!.getAddress(msg.addressNList);
      });
    }

    async nearSignTx(msg: core.NearSignTx): Promise<core.NearSignedTx | null> {
      return this.needsMnemonic(!!this.nearAdapter, async () => {
        const signature = await this.nearAdapter!.signTransaction(msg.txBytes, msg.addressNList);
        const publicKey = await this.nearAdapter!.getPublicKey(msg.addressNList);

        return {
          signature,
          publicKey,
        };
      });
    }
  };
}
