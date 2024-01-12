import type { StdTx } from "@cosmjs/amino";
import type { SignerData } from "@cosmjs/stargate";
import * as core from "@shapeshiftoss/hdwallet-core";
import * as bech32 from "bech32";
import CryptoJS from "crypto-js";
import PLazy from "p-lazy";

import * as Isolation from "./crypto/isolation";
import { NativeHDWalletBase } from "./native";
import * as util from "./util";

const MAYA_CHAIN = "mayachain-mainnet-v1";

const protoTxBuilder = PLazy.from(() => import("@shapeshiftoss/proto-tx-builder"));

export function MixinNativeMayachainWalletInfo<TBase extends core.Constructor<core.HDWalletInfo>>(Base: TBase) {
  // eslint-disable-next-line @typescript-eslint/no-shadow
  return class MixinNativeMayachainWalletInfo extends Base implements core.MayachainWalletInfo {
    readonly _supportsMayachainInfo = true;
    async mayachainSupportsNetwork(): Promise<boolean> {
      return true;
    }

    async mayachainSupportsSecureTransfer(): Promise<boolean> {
      return false;
    }

    mayachainSupportsNativeShapeShift(): boolean {
      return false;
    }

    mayachainGetAccountPaths(msg: core.MayachainGetAccountPaths): Array<core.MayachainAccountPath> {
      const slip44 = core.slip44ByCoin("Mayachain");
      return [
        {
          addressNList: [0x80000000 + 44, 0x80000000 + slip44, 0x80000000 + msg.accountIdx, 0, 0],
        },
      ];
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    mayachainNextAccountPath(msg: core.MayachainAccountPath): core.MayachainAccountPath | undefined {
      // Only support one account for now (like portis).
      return undefined;
    }
  };
}

export function MixinNativeMayachainWallet<TBase extends core.Constructor<NativeHDWalletBase>>(Base: TBase) {
  // eslint-disable-next-line @typescript-eslint/no-shadow
  return class MixinNativeMayachainWallet extends Base {
    readonly _supportsMayachain = true;

    #masterKey: Isolation.Core.BIP32.Node | undefined;

    async mayachainInitializeWallet(masterKey: Isolation.Core.BIP32.Node): Promise<void> {
      this.#masterKey = masterKey;
    }

    mayachainWipe(): void {
      this.#masterKey = undefined;
    }

    mayachainBech32ify(address: ArrayLike<number>, prefix: string): string {
      const words = bech32.toWords(address);
      return bech32.encode(prefix, words);
    }

    createMayachainAddress(publicKey: string) {
      const message = CryptoJS.SHA256(CryptoJS.enc.Hex.parse(publicKey));
      const hash = CryptoJS.RIPEMD160(message as any).toString();
      const address = Buffer.from(hash, `hex`);
      return this.mayachainBech32ify(address, `maya`);
    }

    async mayachainGetAddress(msg: core.MayachainGetAddress): Promise<string | null> {
      return this.needsMnemonic(!!this.#masterKey, async () => {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const keyPair = await util.getKeyPair(this.#masterKey!, msg.addressNList, "mayachain");
        return this.createMayachainAddress(keyPair.publicKey.toString("hex"));
      });
    }

    async mayachainSignTx(msg: core.MayachainSignTx): Promise<core.MayachainSignedTx | null> {
      return this.needsMnemonic(!!this.#masterKey, async () => {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const keyPair = await util.getKeyPair(this.#masterKey!, msg.addressNList, "mayachain");
        const adapter = await Isolation.Adapters.CosmosDirect.create(keyPair.node, "maya");

        const signerData: SignerData = {
          sequence: Number(msg.sequence),
          accountNumber: Number(msg.account_number),
          chainId: MAYA_CHAIN,
        };

        return (await protoTxBuilder).sign(adapter.address, msg.tx as StdTx, adapter, signerData, "maya");
      });
    }
  };
}
