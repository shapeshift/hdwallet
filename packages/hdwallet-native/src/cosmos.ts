import * as core from "@shapeshiftoss/hdwallet-core";

import { addressNListToBIP32, CosmosSignTx, CosmosSignedTx } from "@shapeshiftoss/hdwallet-core";

let txBuilder = require("@bithighlander/cosmos-tx-builder");
import HDKey from "hdkey";
const bip39 = require(`bip39`);

export function MixinNativeCosmosWalletInfo<TBase extends core.Constructor>(Base: TBase) {
  return class MixinNativeCosmosWalletInfo extends Base implements core.CosmosWalletInfo {
    _supportsCosmosInfo = true;
    //cosmosGetAccountPaths
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
      return [
        {
          addressNList: [0x80000000 + 44, 0x80000000 + 117, 0x80000000 + msg.accountIdx, 0, 0],
          // hardenedPath: [0x80000000 + 44, 0x80000000 + core.slip44ByCoin(msg.coin), 0x80000000 + msg.accountIdx],
          // relPath: [0, 0],
          // description: "Native",
        },
      ];
    }

    cosmosNextAccountPath(msg: core.CosmosAccountPath): core.CosmosAccountPath {
      // Only support one account for now (like portis).
      return undefined;
    }
  };
}

export function MixinNativeCosmosWallet<TBase extends core.Constructor>(Base: TBase) {
  return class MixinNativeCosmosWallet extends Base {
    _supportsCosmos = true;
    #seed = "";

    cosmosInitializeWallet(seed: string): void {
      this.#seed = seed;
    }

    async cosmosGetAddress(msg: core.CosmosGetAddress): Promise<string> {
      console.log("msg: ", msg);
      //TODO
      return "cosmos15cenya0tr7nm3tz2wn3h3zwkht2rxrq7q7h3dj";
    }

    async cosmosSignTx(msg: CosmosSignTx, mnemonic: string, xpriv: string, from: string): Promise<CosmosSignedTx> {
      console.log("MSG: ", msg);
      console.log("mnemonic: ", this.#seed);

      const seed = await bip39.mnemonicToSeed(this.#seed);
      let ATOM_CHAIN = "cosmoshub-3";

      console.log("seed: ", seed);
      let mk = new HDKey.fromMasterSeed(Buffer.from(seed, "hex"));
      // expects bip32
      let path = addressNListToBIP32(msg.addressNList);
      console.log("path: ", path);
      mk = mk.derive(path);

      let privateKey = mk.privateKey;
      let publicKey = mk.publicKey;

      let wallet = {
        privateKey,
        publicKey,
      };

      let result = await txBuilder.sign(msg.tx, wallet, msg.sequence, msg.account_number, ATOM_CHAIN);
      console.log("result: ", result);

      console.log("msg.tx: ", msg.tx);
      console.log("msg.tx: ", JSON.stringify(msg.tx));

      // build final tx
      const signedTx = txBuilder.createSignedTx(msg.tx, result);
      console.log("signedTx: ", signedTx);

      return signedTx;
    }
  };
}
