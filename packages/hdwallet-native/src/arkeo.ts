import { StdTx } from "@cosmjs/amino";
import { SignerData } from "@cosmjs/stargate";
import * as core from "@shapeshiftoss/hdwallet-core";
import * as bech32 from "bech32";
import CryptoJS from "crypto-js";
import PLazy from "p-lazy";

import * as Isolation from "./crypto/isolation";
import { NativeHDWalletBase } from "./native";
import * as util from "./util";

const ARKEO_CHAIN = "arkeo-mainnet-1";

const protoTxBuilder = PLazy.from(() => import("@shapeshiftoss/proto-tx-builder"));

export function MixinNativeArkeoWalletInfo<TBase extends core.Constructor<core.HDWalletInfo>>(Base: TBase) {
  // eslint-disable-next-line @typescript-eslint/no-shadow
  return class MixinNativeArkeoWalletInfo extends Base implements core.ArkeoWalletInfo {
    readonly _supportsArkeoInfo = true;
    async arkeoSupportsNetwork(): Promise<boolean> {
      return true;
    }

    async arkeoSupportsSecureTransfer(): Promise<boolean> {
      return false;
    }

    arkeoSupportsNativeShapeShift(): boolean {
      return false;
    }

    arkeoGetAccountPaths(msg: core.ArkeoGetAccountPaths): Array<core.ArkeoAccountPath> {
      const slip44 = core.slip44ByCoin("Arkeo");
      return [
        {
          addressNList: [0x80000000 + 44, 0x80000000 + slip44, 0x80000000 + msg.accountIdx, 0, 0],
        },
      ];
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    arkeoNextAccountPath(msg: core.ArkeoAccountPath): core.ArkeoAccountPath | undefined {
      // Only support one account for now (like portis).
      return undefined;
    }
  };
}

export function MixinNativeArkeoWallet<TBase extends core.Constructor<NativeHDWalletBase>>(Base: TBase) {
  // eslint-disable-next-line @typescript-eslint/no-shadow
  return class MixinNativeArkeoWallet extends Base {
    readonly _supportsArkeo = true;

    #masterKey: Isolation.Core.BIP32.Node | undefined;

    async arkeoInitializeWallet(masterKey: Isolation.Core.BIP32.Node): Promise<void> {
      this.#masterKey = masterKey;
    }

    arkeoWipe(): void {
      this.#masterKey = undefined;
    }

    arkeoBech32ify(address: ArrayLike<number>, prefix: string): string {
      const words = bech32.toWords(address);
      return bech32.encode(prefix, words);
    }

    createArkeoAddress(publicKey: string) {
      const message = CryptoJS.SHA256(CryptoJS.enc.Hex.parse(publicKey));
      const hash = CryptoJS.RIPEMD160(message as any).toString();
      const address = Buffer.from(hash, `hex`);
      return this.arkeoBech32ify(address, `arkeo`);
    }

    async arkeoGetAddress(msg: core.ArkeoGetAddress): Promise<string | null> {
      return this.needsMnemonic(!!this.#masterKey, async () => {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const keyPair = await util.getKeyPair(this.#masterKey!, msg.addressNList, "arkeo");
        return this.createArkeoAddress(keyPair.publicKey.toString("hex"));
      });
    }

    async arkeoSignTx(msg: core.ArkeoSignTx): Promise<core.CosmosSignedTx | null> {
      return this.needsMnemonic(!!this.#masterKey, async () => {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const keyPair = await util.getKeyPair(this.#masterKey!, msg.addressNList, "arkeo");
        const adapter = await Isolation.Adapters.CosmosDirect.create(keyPair.node, "arkeo");

        const signerData: SignerData = {
          sequence: Number(msg.sequence),
          accountNumber: Number(msg.account_number),
          chainId: ARKEO_CHAIN,
        };
        return (await protoTxBuilder).sign(adapter.address, msg.tx as StdTx, adapter, signerData, "arkeo");
      });
    }
  };
}
