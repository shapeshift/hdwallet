import * as core from "@shapeshiftoss/hdwallet-core";
import * as protoTxBuilder from "@shapeshiftoss/proto-tx-builder";
import * as bech32 from "bech32";
import CryptoJS from "crypto-js";

import * as Isolation from "./crypto/isolation";
import { NativeHDWalletBase } from "./native";
import * as util from "./util";

const ATOM_CHAIN = "cosmoshub-4";

export function MixinNativeCosmosWalletInfo<TBase extends core.Constructor<core.HDWalletInfo>>(Base: TBase) {
  // eslint-disable-next-line @typescript-eslint/no-shadow
  return class MixinNativeCosmosWalletInfo extends Base implements core.CosmosWalletInfo {
    readonly _supportsCosmosInfo = true;
    async cosmosSupportsNetwork(): Promise<boolean> {
      return true;
    }

    async cosmosSupportsSecureTransfer(): Promise<boolean> {
      return false;
    }

    cosmosSupportsNativeShapeShift(): boolean {
      return false;
    }

    cosmosGetAccountPaths(msg: core.CosmosGetAccountPaths): Array<core.CosmosAccountPath> {
      const slip44 = core.slip44ByCoin("Atom");
      return [
        {
          addressNList: [0x80000000 + 44, 0x80000000 + slip44, 0x80000000 + msg.accountIdx, 0, 0],
        },
      ];
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    cosmosNextAccountPath(msg: core.CosmosAccountPath): core.CosmosAccountPath | undefined {
      // Only support one account for now (like portis).
      return undefined;
    }
  };
}

export function MixinNativeCosmosWallet<TBase extends core.Constructor<NativeHDWalletBase>>(Base: TBase) {
  // eslint-disable-next-line @typescript-eslint/no-shadow
  return class MixinNativeCosmosWallet extends Base {
    readonly _supportsCosmos = true;

    #masterKey: Isolation.Core.BIP32.Node | undefined;

    async cosmosInitializeWallet(masterKey: Isolation.Core.BIP32.Node): Promise<void> {
      this.#masterKey = masterKey;
    }

    cosmosWipe(): void {
      this.#masterKey = undefined;
    }

    cosmosBech32ify(address: ArrayLike<number>, prefix: string): string {
      const words = bech32.toWords(address);
      return bech32.encode(prefix, words);
    }

    createCosmosAddress(publicKey: string) {
      const message = CryptoJS.SHA256(CryptoJS.enc.Hex.parse(publicKey));
      const hash = CryptoJS.RIPEMD160(message as any).toString();
      const address = Buffer.from(hash, `hex`);
      return this.cosmosBech32ify(address, `cosmos`);
    }

    async cosmosGetAddress(msg: core.CosmosGetAddress): Promise<string | null> {
      return this.needsMnemonic(!!this.#masterKey, async () => {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const keyPair = await util.getKeyPair(this.#masterKey!, msg.addressNList, "cosmos");
        return this.createCosmosAddress(keyPair.publicKey.toString("hex"));
      });
    }

    async cosmosSignTx(msg: core.CosmosSignTx): Promise<core.CosmosSignedTx | null> {
      return this.needsMnemonic(!!this.#masterKey, async () => {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const keyPair = await util.getKeyPair(this.#masterKey!, msg.addressNList, "cosmos");
        const adapter = await Isolation.Adapters.CosmosDirect.create(keyPair.node, "cosmos");
        const result = await protoTxBuilder.sign(msg.tx, adapter, msg.sequence, msg.account_number, ATOM_CHAIN);
        return result;
      });
    }
  };
}
