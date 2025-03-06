import * as core from "@shapeshiftoss/hdwallet-core";

import { Isolation } from "./crypto";
import { SolanaAdapter } from "./crypto/isolation/adapters/solana";
import { NativeHDWalletBase } from "./native";

export function MixinNativeSolanaWalletInfo<TBase extends core.Constructor<core.HDWalletInfo>>(Base: TBase) {
  // eslint-disable-next-line @typescript-eslint/no-shadow
  return class MixinNativeSolanaWalletInfo extends Base implements core.SolanaWalletInfo {
    readonly _supportsSolanaInfo = true;

    solanaGetAccountPaths(msg: core.SolanaGetAccountPaths): Array<core.SolanaAccountPath> {
      return core.solanaGetAccountPaths(msg);
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    solanaNextAccountPath(msg: core.SolanaAccountPath): core.SolanaAccountPath | undefined {
      throw new Error("Method not implemented");
    }
  };
}

export function MixinNativeSolanaWallet<TBase extends core.Constructor<NativeHDWalletBase>>(Base: TBase) {
  // eslint-disable-next-line @typescript-eslint/no-shadow
  return class MixinNativeSolanaWallet extends Base {
    readonly _supportsSolana = true;

    adapter: SolanaAdapter | undefined;

    async solanaInitializeWallet(masterKey: Isolation.Core.Ed25519.Node): Promise<void> {
      const nodeAdapter = new Isolation.Adapters.Ed25519(masterKey);
      this.adapter = new SolanaAdapter(nodeAdapter);
    }

    solanaWipe() {
      this.adapter = undefined;
    }

    async solanaGetAddress(msg: core.SolanaGetAddress): Promise<string | null> {
      return this.needsMnemonic(!!this.adapter, () => {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        return this.adapter!.getAddress(msg.addressNList);
      });
    }

    async solanaSignTx(msg: core.SolanaSignTx): Promise<core.SolanaSignedTx | null> {
      return this.needsMnemonic(!!this.adapter, async () => {
        const address = await this.solanaGetAddress({
          addressNList: msg.addressNList,
          showDisplay: false,
        });

        if (!address) throw new Error("Failed to get Solana address");

        const transaction = core.solanaBuildTransaction(msg, address);
        const signedTransaction = await this.adapter!.signTransaction(transaction, msg.addressNList);

        return {
          serialized: Buffer.from(signedTransaction.serialize()).toString("base64"),
          signatures: signedTransaction.signatures.map((signature) => Buffer.from(signature).toString("base64")),
        };
      });
    }
  };
}
