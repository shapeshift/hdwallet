import type { StdTx } from "@cosmjs/amino";
import type { SignerData } from "@cosmjs/stargate";
import * as core from "@keepkey/hdwallet-core";
import * as bech32 from "bech32";
import CryptoJS from "crypto-js";
import PLazy from "p-lazy";

import * as Isolation from "./crypto/isolation";
import { NativeHDWalletBase } from "./native";
import * as util from "./util";

const THOR_CHAIN = "thorchain-mainnet-v1";

const protoTxBuilder = PLazy.from(() => import("@shapeshiftoss/proto-tx-builder"));

export function MixinNativeThorchainWalletInfo<TBase extends core.Constructor<core.HDWalletInfo>>(Base: TBase) {
  // eslint-disable-next-line @typescript-eslint/no-shadow
  return class MixinNativeThorchainWalletInfo extends Base implements core.ThorchainWalletInfo {
    readonly _supportsThorchainInfo = true;
    async thorchainSupportsNetwork(): Promise<boolean> {
      return true;
    }

    async thorchainSupportsSecureTransfer(): Promise<boolean> {
      return false;
    }

    thorchainSupportsNativeShapeShift(): boolean {
      return false;
    }

    thorchainGetAccountPaths(msg: core.ThorchainGetAccountPaths): Array<core.ThorchainAccountPath> {
      const slip44 = core.slip44ByCoin("Thorchain");
      return [
        {
          addressNList: [0x80000000 + 44, 0x80000000 + slip44, 0x80000000 + msg.accountIdx, 0, 0],
        },
      ];
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    thorchainNextAccountPath(msg: core.ThorchainAccountPath): core.ThorchainAccountPath | undefined {
      // Only support one account for now (like portis).
      return undefined;
    }
  };
}

export function MixinNativeThorchainWallet<TBase extends core.Constructor<NativeHDWalletBase>>(Base: TBase) {
  // eslint-disable-next-line @typescript-eslint/no-shadow
  return class MixinNativeThorchainWallet extends Base {
    readonly _supportsThorchain = true;

    #masterKey: Isolation.Core.BIP32.Node | undefined;

    async thorchainInitializeWallet(masterKey: Isolation.Core.BIP32.Node): Promise<void> {
      this.#masterKey = masterKey;
    }

    thorchainWipe(): void {
      this.#masterKey = undefined;
    }

    thorchainBech32ify(address: ArrayLike<number>, prefix: string): string {
      const words = bech32.toWords(address);
      return bech32.encode(prefix, words);
    }

    createThorchainAddress(publicKey: string) {
      const message = CryptoJS.SHA256(CryptoJS.enc.Hex.parse(publicKey));
      const hash = CryptoJS.RIPEMD160(message as any).toString();
      const address = Buffer.from(hash, `hex`);
      return this.thorchainBech32ify(address, `thor`);
    }

    async thorchainGetAddress(msg: core.ThorchainGetAddress): Promise<string | null> {
      return this.needsMnemonic(!!this.#masterKey, async () => {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const keyPair = await util.getKeyPair(this.#masterKey!, msg.addressNList, "thorchain");
        return this.createThorchainAddress(keyPair.publicKey.toString("hex"));
      });
    }

    async thorchainSignTx(msg: core.ThorchainSignTx): Promise<core.ThorchainSignedTx | null> {
      return this.needsMnemonic(!!this.#masterKey, async () => {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const keyPair = await util.getKeyPair(this.#masterKey!, msg.addressNList, "thorchain");
        const adapter = await Isolation.Adapters.CosmosDirect.create(keyPair.node, "thor");

        const signerData: SignerData = {
          sequence: Number(msg.sequence),
          accountNumber: Number(msg.account_number),
          chainId: THOR_CHAIN,
        };

        return (await protoTxBuilder).sign(adapter.address, msg.tx as StdTx, adapter, signerData, "thor");
      });
    }
  };
}
