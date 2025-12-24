import * as core from "@shapeshiftoss/hdwallet-core";

import { Isolation } from "./crypto";
import { StarknetAdapter } from "./crypto/isolation/adapters/starknet";
import { NativeHDWalletBase } from "./native";

export function MixinNativeStarknetWalletInfo<TBase extends core.Constructor<core.HDWalletInfo>>(Base: TBase) {
  return class MixinNativeStarknetWalletInfoClass extends Base implements core.StarknetWalletInfo {
    readonly _supportsStarknetInfo = true;

    starknetGetAccountPaths(msg: core.StarknetGetAccountPaths): Array<core.StarknetAccountPath> {
      return core.starknetGetAccountPaths(msg);
    }

    starknetNextAccountPath(): core.StarknetAccountPath | undefined {
      throw new Error("Method not implemented");
    }
  };
}

export function MixinNativeStarknetWallet<TBase extends core.Constructor<NativeHDWalletBase>>(Base: TBase) {
  return class MixinNativeStarknetWalletClass extends Base {
    readonly _supportsStarknet = true;

    starknetAdapter: StarknetAdapter | undefined;

    async starknetInitializeWallet(masterKey: Isolation.Core.BIP32.Node): Promise<void> {
      const nodeAdapter = await Isolation.Adapters.BIP32.create(masterKey);
      this.starknetAdapter = new StarknetAdapter(nodeAdapter);
    }

    starknetWipe() {
      this.starknetAdapter = undefined;
    }

    async starknetGetAddress(msg: core.StarknetGetAddress): Promise<string | null> {
      return this.needsMnemonic(!!this.starknetAdapter, () => {
        return this.starknetAdapter!.getAddress(msg.addressNList);
      });
    }

    async starknetSignTx(msg: core.StarknetSignTx): Promise<core.StarknetSignedTx | null> {
      return this.needsMnemonic(!!this.starknetAdapter, async () => {
        const signature = await this.starknetAdapter!.signTransaction(msg.txHash, msg.addressNList);

        return {
          signature,
        };
      });
    }
  };
}
