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
          "msg": [
            {
              "type": "cosmos-sdk/MsgSend",
              "value": {
                "from_address": "cosmos15cenya0tr7nm3tz2wn3h3zwkht2rxrq7q7h3dj",
                "to_address": "cosmos1qjwdyn56ecagk8rjf7crrzwcyz6775cj89njn3",
                "amount": [
                  {
                    "denom": "uatom",
                    "amount": "1000"
                  }
                ]
              }
            }
          ],
          "fee": {
            "amount": [
              {
                "denom": "uatom",
                "amount": "100"
              }
            ],
            "gas": "100000"
          },
          "signatures": [
            {
              "signature": "rHB38uopPype0mom6WiIEOi60qZcXvYuJNz3RAXH6hthgU4FgQtp8PK9R+L/8pn92RdrhPZ3VYY5w3Y7HNbOmA==",
              "account_number": "16354",
              "sequence": "5",
              "pub_key": {
                "type": "tendermint/PubKeySecp256k1",
                "value": "A77jrzDlOnPzirxaL82sQm17BOtyqOvTsBmS4tIG4krY"
              }
            }
          ],
          "memo": "Sent from the citadel! "
        }
      });
    }
  };
}
