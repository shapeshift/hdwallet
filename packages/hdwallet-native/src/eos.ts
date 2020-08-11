import * as core from "@bithighlander/hdwallet-core";

import { addressNListToBIP32, CosmosSignTx, CosmosSignedTx } from "@bithighlander/hdwallet-core";
import HDKey from "hdkey";
const bip39 = require(`bip39`);
let { PrivateKey, PublicKey, Signature, Aes, key_utils, config } = require("eosjs-ecc");
const hdPathEos = `m/44'/194'/0'/0/0`; // REF: EOS: https://github.com/GetScatter/ScatterDesktop/blob/63701f48dc4597732b6a446c15e90a66fbfa7989/electron/hardware/LedgerWallet.js#L56
let bitcoin = require("bitcoinjs-lib");
const bip32 = require(`bip32`);
const secp256k1 = require(`secp256k1`);

// NOTE: this only works with a compressed public key (33 bytes)
function createEOSAddress(privateKey) {
  try {
    privateKey = PrivateKey.fromBuffer(privateKey);
    privateKey = privateKey.toWif();
    let pubkey = PrivateKey.fromString(privateKey).toPublic().toString();
    return pubkey;
  } catch (e) {
    throw Error(e);
  }
}

async function deriveMasterKey(mnemonic) {
  // throws if mnemonic is invalid
  bip39.validateMnemonic(mnemonic);

  const seed = await bip39.mnemonicToSeed(mnemonic);
  // let masterKey =  new HDKey.fromMasterSeed(new Buffer(seed, 'hex'), coininfo(network).versions.bip32.versions)
  // log.debug("masterKey: ",masterKey)
  let mk = new HDKey.fromMasterSeed(Buffer.from(seed, "hex"));

  //get eos-network key
  mk = mk.derive("m/44'/194'/0'");

  //get correct address with xpub
  let xpub = mk.publicExtendedKey;

  const masterKey = bip32.fromSeed(seed);
  return { masterKey, xpub };
}

function deriveKeypair(masterKey) {
  const cosmosHD = masterKey.derivePath(hdPathEos);
  const privateKey = cosmosHD.privateKey;
  const publicKey = secp256k1.publicKeyCreate(privateKey, true);

  return {
    privateKey,
    publicKey,
  };
}

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
      const { masterKey, xpub } = await deriveMasterKey(this.#seed);
      //

      let { privateKey, publicKey } = deriveKeypair(masterKey);

      let address = await createEOSAddress(privateKey);

      return address;
    }

    async eosSignTx(msg: any): Promise<any> {
      const seed = await bip39.mnemonicToSeed(this.#seed);

      let mk = new HDKey.fromMasterSeed(Buffer.from(seed, "hex"));
      // expects bip32
      let path = core.addressNListToBIP32(msg.addressNList);
      mk = mk.derive(path);

      let privateKey = mk.privateKey;

      //convert privkey to EOS format
      privateKey = PrivateKey.fromBuffer(privateKey);
      privateKey = privateKey.toString();

      let URL_REMOTE = "https://api.eossweden.org"; //not used (TODO fork eosjs and removeme)
      //
      let { Api, JsonRpc, RpcError } = require("eosjs");
      const { JsSignatureProvider } = require("eosjs/dist/eosjs-jssig"); // development only
      const fetch = require("node-fetch"); // node only; not needed in browsers
      const { TextEncoder, TextDecoder } = require("util");
      const privateKeys = [privateKey];
      const signatureProvider = new JsSignatureProvider(privateKeys);

      console.log(signatureProvider.keys);

      console.log("Checkpoint 2");
      const rpc = new JsonRpc(URL_REMOTE, { fetch });
      const api = new Api({ rpc, signatureProvider, textDecoder: new TextDecoder(), textEncoder: new TextEncoder() });

      console.log("Checkpoint 3");
      let result = await api.transact(
        {
          actions: msg.tx.actions,
        },
        {
          broadcast: false,
          blocksBehind: 3,
          expireSeconds: 300,
        }
      );
      console.log("Checkpoint 4");
      console.log("result: ", result);
      console.log("result: ", result.serialized);

      let serialized = result.serializedTransaction;
      serialized = new Buffer(result.serializedTransaction).toString("hex");

      let sig = {
        serialized,
        eosFormSig: result.signatures,
      };

      return sig;
    }
  };
}
