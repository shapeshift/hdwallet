import * as core from "@shapeshiftoss/hdwallet-core";

import * as Isolation from "./crypto/isolation";
import SignerAdapter from "./crypto/isolation/adapters/solana";
import { NativeHDWalletBase } from "./native";
import * as util from "./util";

export function MixinNativeSolanaWalletInfo<TBase extends core.Constructor<core.HDWalletInfo>>(Base: TBase) {
  // eslint-disable-next-line @typescript-eslint/no-shadow
  return class MixinNativeSolanaWalletInfo extends Base implements core.SolanaWalletInfo {
    readonly _supportsSolanaInfo = true;
    _chainId = 1;

    solanaGetAccountPaths(msg: core.ETHGetAccountPath): Array<core.SolanaAccountPath> {
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

    #solanaSigner: SignerAdapter | undefined;
    #masterKey: Isolation.Core.BIP32.Node | undefined;

    async solanaInitializeWallet(masterKey: Isolation.Core.BIP32.Node): Promise<void> {
      this.#masterKey = masterKey;
    }
    solanaWipe() {
      this.#solanaSigner = undefined;
    }

    // TODO(gomes): make getAddress in adapter work with addressNList to support multi-account
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async solanaGetAddress(msg: core.SolanaGetAddress): Promise<string | null> {
      return this.needsMnemonic(!!this.#solanaSigner, () => {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        return this.#solanaSigner!.getAddress();
      });
    }

    async solanaSignTx(msg: core.SolanaSignTx): Promise<core.SolanaSignedTx | null> {
      return this.needsMnemonic(!!this.#masterKey, async () => {
        const keyPair = await util.getKeyPair(this.#masterKey!, msg.addressNList, "solana");

        // Create the adapter for isolated signing
        const adapter = await Isolation.Adapters.SolanaDirect.create(keyPair.node);

        // Get the address
        const address = await this.solanaGetAddress({
          addressNList: msg.addressNList,
          showDisplay: false,
        });

        if (!address) throw new Error("Failed to get Solana address");

        const transaction = core.solanaBuildTransaction(msg, address);
        const signedTx = await adapter.signDirect(transaction);

        const serializedData = signedTx.serialize();

        return {
          serialized: Buffer.from(serializedData).toString("base64"),
          signatures: signedTx.signatures.map((signature) => Buffer.from(signature).toString("base64")),
        };
      });
    }
  };
}
