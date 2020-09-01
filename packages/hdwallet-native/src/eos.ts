import * as core from "@bithighlander/hdwallet-core";

import { getNetwork } from "./networks";
import { mnemonicToSeed } from "bip39";
const bip39 = require(`bip39`);
// let { PrivateKey } = require("eosjs-ecc");
let bitcoin = require("bitcoinjs-lib");

// NOTE: this only works with a compressed public key (33 bytes)
// function createEOSAddress(privateKey) {
//   try {
//     privateKey = PrivateKey.fromBuffer(privateKey);
//     privateKey = privateKey.toWif();
//     let pubkey = PrivateKey.fromString(privateKey).toPublic().toString();
//     return pubkey;
//   } catch (e) {
//     throw Error(e);
//   }
// }

export function MixinNativeEosWalletInfo<TBase extends core.Constructor>(Base: TBase) {
  return class MixinNativeEosWalletInfo extends Base implements core.EosWalletInfo {
    _supportsEosInfo = true;

    async eosSupportsNetwork(): Promise<boolean> {
      return true;
    }

    async eosSupportsSecureTransfer(): Promise<boolean> {
      return false;
    }

    eosSupportsNativeShapeShift(): boolean {
      return false;
    }

    eosGetAccountPaths(msg: any): Array<core.EosAccountPath> {
      return [
        {
          addressNList: [0x80000000 + 44, 0x80000000 + 194, 0x80000000 + msg.accountIdx, 0, 0],
          // hardenedPath: [0x80000000 + 44, 0x80000000 + 194, 0x80000000 + msg.accountIdx],
          // relPath: [0, 0],
          // description: "Native",
        },
      ];
    }

    eosNextAccountPath(msg: core.EosAccountPath): core.EosAccountPath {
      // Only support one account for now (like portis).
      // the eosers library supports paths so it shouldnt be too hard if we decide multiple accounts are needed
      return undefined;
    }
  };
}

export function MixinNativeEosWallet<TBase extends core.Constructor>(Base: TBase) {
  return class MixinNativeEosWallet extends Base {
    _supportsEos = true;
    #seed = "";

    eosInitializeWallet(seed: string): void {
      this.#seed = seed;
    }

    async eosGetAddress(msg: any): Promise<string> {
      const seed = await mnemonicToSeed(this.#seed);
      const network = getNetwork("bitcoin");
      const wallet = bitcoin.bip32.fromSeed(seed, network);
      const path = core.addressNListToBIP32(msg.addressNList);
      const keypair = await bitcoin.ECPair.fromWIF(wallet.derivePath(path).toWIF(), network);

      //let address = await createEOSAddress(keypair.privateKey);

      return "lol";
    }

    async eosSignTx(msg: any): Promise<any> {
      const seed = await bip39.mnemonicToSeed(this.#seed);

      const network = getNetwork("cosmos");
      const mKey = bitcoin.bip32.fromSeed(seed, network);
      const path = core.addressNListToBIP32(msg.addressNList);

      let keypair = await bitcoin.ECPair.fromWIF(mKey.derivePath(path).toWIF(), network);
      let privateKey = keypair.privateKey.toString("hex");

      //convert privkey to EOS format
      // privateKey = PrivateKey.fromBuffer(privateKey);
      privateKey = "";

      let URL_REMOTE = "https://api.eossweden.org"; //not used (TODO fork eosjs and removeme)
      //
      // let { Api, JsonRpc, RpcError } = require("eosjs");
      // const { JsSignatureProvider } = require("eosjs/dist/eosjs-jssig"); // development only
      // const fetch = require("node-fetch"); // node only; not needed in browsers
      // const { TextEncoder, TextDecoder } = require("util");
      // const privateKeys = [privateKey];
      // const signatureProvider = new JsSignatureProvider(privateKeys);

      // const rpc = new JsonRpc(URL_REMOTE, { fetch });
      // const api = new Api({ rpc, signatureProvider, textDecoder: new TextDecoder(), textEncoder: new TextEncoder() });

      // let result = await api.transact(
      //   {
      //     actions: msg.tx.actions,
      //   },
      //   {
      //     broadcast: false,
      //     blocksBehind: 3,
      //     expireSeconds: 300,
      //   }
      // );

      // let serialized = result.serializedTransaction;
      // serialized = new Buffer(result.serializedTransaction).toString("hex");

      let sig = {
        serialized: "",
        eosFormSig: "",
      };

      return sig;
    }
  };
}
