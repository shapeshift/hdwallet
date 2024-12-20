import * as core from "@shapeshiftoss/hdwallet-core";

import * as Isolation from "./crypto/isolation";
import BIP32Ed25519Adapter from "./crypto/isolation/adapters/bip32ed25519";
import { SolanaDirectAdapter } from "./crypto/isolation/adapters/solana";
import { NativeHDWalletBase } from "./native";

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
    #solanaSigner: SolanaDirectAdapter | undefined;

    async solanaInitializeWallet(masterKey: Isolation.Core.BIP32.Node): Promise<void> {
      // Create an Ed25519 BIP32 adapter directly from our masterKey
      const ed25519Adapter = await BIP32Ed25519Adapter.fromNode(masterKey);

      // Initialize the Solana adapter with the Ed25519 adapter
      this.#solanaSigner = new SolanaDirectAdapter(ed25519Adapter);
    }

    solanaWipe() {
      this.#solanaSigner = undefined;
    }

    async solanaGetAddress(msg: core.SolanaGetAddress): Promise<string | null> {
      return this.needsMnemonic(!!this.#solanaSigner, () => {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        return this.#solanaSigner!.getAddress(msg.addressNList);
      });
    }

    async solanaSignTx(msg: core.SolanaSignTx): Promise<core.SolanaSignedTx | null> {
      return this.needsMnemonic(!!this.#solanaSigner, async () => {
        const address = await this.solanaGetAddress({
          addressNList: msg.addressNList,
          showDisplay: false,
        });

        if (!address) throw new Error("Failed to get Solana address");

        const transaction = core.solanaBuildTransaction(msg, address);
        const signedTx = await this.#solanaSigner!.signDirect(transaction, msg.addressNList);
        const serializedData = signedTx.serialize();

        return {
          serialized: Buffer.from(serializedData).toString("base64"),
          signatures: signedTx.signatures.map((signature) => Buffer.from(signature).toString("base64")),
        };
      });
    }
  };
}
