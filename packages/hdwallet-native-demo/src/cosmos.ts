import * as core from "@shapeshiftoss/hdwallet-core";
import * as bech32 from "bech32";
import CryptoJS from "crypto-js";
import * as protoTxBuilder from "@shapeshiftoss/proto-tx-builder";

import { NativeHDWalletBase } from "./native";

const ATOM_CHAIN = "cosmoshub-4";

export function MixinNativeCosmosWalletInfo<TBase extends core.Constructor<core.HDWalletInfo>>(Base: TBase) {
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
      const slip44 = core.slip44ByCoin("Atom")
      return [
        {
          addressNList: [0x80000000 + 44, 0x80000000 + slip44, 0x80000000 + msg.accountIdx, 0, 0],
        },
      ];
    }

    cosmosNextAccountPath(msg: core.CosmosAccountPath): core.CosmosAccountPath | undefined {
      // Only support one account for now (like portis).
      return undefined;
    }
  };
}

export function MixinNativeCosmosWallet<TBase extends core.Constructor<NativeHDWalletBase>>(Base: TBase) {
  return class MixinNativeCosmosWallet extends Base {
    readonly _supportsCosmos = true;

    #masterKey: any | undefined;

    async cosmosInitializeWallet(masterKey:any): Promise<void> {
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
        return "cosmos1knuunh0lmwyrkjmrj7sky49uxk3peyzhzsvqqf"
      });
    }

    async cosmosSignTx(msg: core.CosmosSignTx): Promise<any | null> {
      return this.needsMnemonic(!!this.#masterKey, async () => {
        return {
          "serialized": "CrsBCrgBCikvaWJjLmFwcGxpY2F0aW9ucy50cmFuc2Zlci52MS5Nc2dUcmFuc2ZlchKKAQoIdHJhbnNmZXISC2NoYW5uZWwtMTQxGgwKBXVhdG9tEgMxMDAiLWNvc21vczE1Y2VueWEwdHI3bm0zdHoyd24zaDN6d2todDJyeHJxN3E3aDNkaiorb3NtbzE1Y2VueWEwdHI3bm0zdHoyd24zaDN6d2todDJyeHJxN2c5eXBtcTIHCAEQy4e6BBJnClAKRgofL2Nvc21vcy5jcnlwdG8uc2VjcDI1NmsxLlB1YktleRIjCiEDvuOvMOU6c/OKvFovzaxCbXsE63Ko69OwGZLi0gbiStgSBAoCCAEYGxITCg0KBXVhdG9tEgQyODAwENDZERpARca0xhdMkItu+qnyzj58LkGyMKCBS+HwJRO+samk7RxJxo3rtoftuk/4JNNEjTKIsIurzoR8lXQgu1yS2IDh8A==",
          "body": "CrgBCikvaWJjLmFwcGxpY2F0aW9ucy50cmFuc2Zlci52MS5Nc2dUcmFuc2ZlchKKAQoIdHJhbnNmZXISC2NoYW5uZWwtMTQxGgwKBXVhdG9tEgMxMDAiLWNvc21vczE1Y2VueWEwdHI3bm0zdHoyd24zaDN6d2todDJyeHJxN3E3aDNkaiorb3NtbzE1Y2VueWEwdHI3bm0zdHoyd24zaDN6d2todDJyeHJxN2c5eXBtcTIHCAEQy4e6BA==",
          "authInfoBytes": "ClAKRgofL2Nvc21vcy5jcnlwdG8uc2VjcDI1NmsxLlB1YktleRIjCiEDvuOvMOU6c/OKvFovzaxCbXsE63Ko69OwGZLi0gbiStgSBAoCCAEYGxITCg0KBXVhdG9tEgQyODAwENDZEQ==",
          "signatures": [
            "Rca0xhdMkItu+qnyzj58LkGyMKCBS+HwJRO+samk7RxJxo3rtoftuk/4JNNEjTKIsIurzoR8lXQgu1yS2IDh8A=="
          ]
        }
      });
    }
  };
}
