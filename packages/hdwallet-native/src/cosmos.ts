import * as core from "@shapeshiftoss/hdwallet-core";

let txBuilder = require("@bithighlander/cosmos-tx-builder");
import HDKey from "hdkey";
import { mnemonicToSeed } from "bip39";
import bech32 from "bech32";
import CryptoJS from "crypto-js";
import ripemd160 from "crypto-js/ripemd160";
import sha256 from "crypto-js/sha256";

export function MixinNativeCosmosWalletInfo<TBase extends core.Constructor>(Base: TBase) {
  return class MixinNativeCosmosWalletInfo extends Base implements core.CosmosWalletInfo {
    _supportsCosmosInfo = true;
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

    bech32ify(address: ArrayLike<number>, prefix: string): string {
      const words = bech32.toWords(address);
      return bech32.encode(prefix, words);
    }

    createCosmosAddress(publicKey) {
      const message = CryptoJS.enc.Hex.parse(publicKey.toString(`hex`));
      const hash = ripemd160(sha256(message)).toString();
      const address = Buffer.from(hash, `hex`);
      const cosmosAddress = this.bech32ify(address, `cosmos`);
      return cosmosAddress;
    }

    async cosmosGetAddress(msg: core.CosmosGetAddress): Promise<string> {
      const seed = await mnemonicToSeed(this.#seed);

      let mk = new HDKey.fromMasterSeed(Buffer.from(seed));
      // expects bip32
      const path = core.addressNListToBIP32(msg.addressNList);

      const address = this.createCosmosAddress(mk.derive(path).publicKey);
      return address;
    }

    async cosmosSignTx(msg: core.CosmosSignTx): Promise<core.CosmosSignedTx> {
      const seed = await mnemonicToSeed(this.#seed);
      const ATOM_CHAIN = "cosmoshub-3";

      let mk = new HDKey.fromMasterSeed(Buffer.from(seed));
      // expects bip32
      const path = core.addressNListToBIP32(msg.addressNList);
      mk = mk.derive(path);

      const privateKey = mk.privateKey;
      const publicKey = mk.publicKey;

      const wallet = {
        privateKey,
        publicKey,
      };

      const result = await txBuilder.sign(msg.tx, wallet, msg.sequence, msg.account_number, ATOM_CHAIN);

      // build final tx
      const signedTx = txBuilder.createSignedTx(msg.tx, result);

      return signedTx;
    }
  };
}
