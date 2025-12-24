/* eslint-disable no-console */
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

    async starknetInitializeWallet(masterKey: Isolation.Core.Stark.Node): Promise<void> {
      console.log("[MixinNativeStarknetWallet.starknetInitializeWallet] Called with masterKey:", !!masterKey);
      const nodeAdapter = new Isolation.Adapters.Stark(masterKey);
      console.log("[MixinNativeStarknetWallet.starknetInitializeWallet] Node adapter created");
      this.starknetAdapter = new StarknetAdapter(nodeAdapter);
      console.log("[MixinNativeStarknetWallet.starknetInitializeWallet] StarknetAdapter created and assigned");
    }

    starknetWipe() {
      this.starknetAdapter = undefined;
    }

    async starknetGetAddress(msg: core.StarknetGetAddress): Promise<string | null> {
      console.log("[NativeStarknetWallet.starknetGetAddress] Called with:", JSON.stringify(msg));
      console.log("[NativeStarknetWallet.starknetGetAddress] Adapter exists:", !!this.starknetAdapter);
      return this.needsMnemonic(!!this.starknetAdapter, async () => {
        const address = await this.starknetAdapter!.getAddress(msg.addressNList);
        console.log("[NativeStarknetWallet.starknetGetAddress] Result:", address);
        return address;
      });
    }

    async starknetGetPublicKey(msg: core.StarknetGetPublicKey): Promise<string | null> {
      console.log("[NativeStarknetWallet.starknetGetPublicKey] Called with:", JSON.stringify(msg));
      console.log("[NativeStarknetWallet.starknetGetPublicKey] Adapter exists:", !!this.starknetAdapter);
      return this.needsMnemonic(!!this.starknetAdapter, async () => {
        const publicKey = await this.starknetAdapter!.getPublicKey(msg.addressNList);
        console.log("[NativeStarknetWallet.starknetGetPublicKey] Result:", publicKey);
        return publicKey;
      });
    }

    async starknetSignTx(msg: core.StarknetSignTx): Promise<core.StarknetSignedTx | null> {
      console.log("[NativeStarknetWallet.starknetSignTx] Called with:", JSON.stringify(msg));
      console.log("[NativeStarknetWallet.starknetSignTx] Adapter exists:", !!this.starknetAdapter);
      return this.needsMnemonic(!!this.starknetAdapter, async () => {
        const signature = await this.starknetAdapter!.signTransaction(msg.txHash, msg.addressNList);
        console.log("[NativeStarknetWallet.starknetSignTx] Signature:", JSON.stringify(signature));

        const result = {
          signature,
        };
        console.log("[NativeStarknetWallet.starknetSignTx] Result:", JSON.stringify(result));
        return result;
      });
    }
  };
}
