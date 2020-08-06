import * as core from "@shapeshiftoss/hdwallet-core";

import { addressNListToBIP32, CosmosSignTx, CosmosSignedTx } from "@shapeshiftoss/hdwallet-core";

let txBuilder = require("@bithighlander/cosmos-tx-builder");
import HDKey from "hdkey";
const bip39 = require(`bip39`);
const ripemd160 = require("crypto-js/ripemd160");
const CryptoJS = require("crypto-js");
const sha256 = require("crypto-js/sha256");
const bech32 = require(`bech32`);

function bech32ify(address, prefix) {
  const words = bech32.toWords(address);
  return bech32.encode(prefix, words);
}

function createCosmosAddress(publicKey) {
  const message = CryptoJS.enc.Hex.parse(publicKey.toString(`hex`));
  const hash = ripemd160(sha256(message)).toString();
  const address = Buffer.from(hash, `hex`);
  const cosmosAddress = bech32ify(address, `cosmos`);
  return cosmosAddress;
}

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
      //get
      this.#seed = seed;
    }

    async cosmosGetAddress(msg: core.CosmosGetAddress): Promise<string> {
      const seed = await bip39.mnemonicToSeed(this.#seed);

      let mk = new HDKey.fromMasterSeed(Buffer.from(seed, "hex"));
      // expects bip32
      let path = addressNListToBIP32(msg.addressNList);

      mk = mk.derive(path);
      let publicKey = mk.publicKey;
      let address = createCosmosAddress(publicKey);
      return address;
    }

    async cosmosSignTx(msg: CosmosSignTx, mnemonic: string, xpriv: string, from: string): Promise<CosmosSignedTx> {
      const seed = await bip39.mnemonicToSeed(this.#seed);
      let ATOM_CHAIN = "cosmoshub-3";

      let mk = new HDKey.fromMasterSeed(Buffer.from(seed, "hex"));
      // expects bip32
      let path = addressNListToBIP32(msg.addressNList);
      mk = mk.derive(path);

      let privateKey = mk.privateKey;
      let publicKey = mk.publicKey;

      let wallet = {
        privateKey,
        publicKey,
      };

      let result = await txBuilder.sign(msg.tx, wallet, msg.sequence, msg.account_number, ATOM_CHAIN);

      // build final tx
      const signedTx = txBuilder.createSignedTx(msg.tx, result);

      return signedTx;
    }
  };
}
