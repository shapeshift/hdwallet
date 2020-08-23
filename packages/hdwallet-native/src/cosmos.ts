import * as core from "@shapeshiftoss/hdwallet-core";

import txBuilder from "cosmos-tx-builder";
import * as bitcoin from "bitcoinjs-lib";
import { getNetwork } from "./networks";
import { mnemonicToSeed } from "bip39";
import { toWords, encode } from "bech32";
import CryptoJS, { RIPEMD160, SHA256 } from "crypto-js";

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
      const words = toWords(address);
      return encode(prefix, words);
    }

    createCosmosAddress(publicKey: string) {
      const message = SHA256(CryptoJS.enc.Hex.parse(publicKey));
      const hash = RIPEMD160(message as any).toString();
      const address = Buffer.from(hash, `hex`);
      const cosmosAddress = this.bech32ify(address, `cosmos`);
      return cosmosAddress;
    }

    async cosmosGetAddress(msg: core.CosmosGetAddress): Promise<string> {
      const seed = await mnemonicToSeed(this.#seed);

      const network = getNetwork("bitcoin");
      const wallet = bitcoin.bip32.fromSeed(seed, network);
      const path = core.addressNListToBIP32(msg.addressNList);
      const keypair = await bitcoin.ECPair.fromWIF(wallet.derivePath(path).toWIF(), network);
      const address = this.createCosmosAddress(keypair.publicKey.toString("hex"));

      return address;
    }

    async cosmosSignTx(msg: core.CosmosSignTx): Promise<core.CosmosSignedTx> {
      const seed = await mnemonicToSeed(this.#seed);
      const ATOM_CHAIN = "cosmoshub-3";

      const network = getNetwork("cosmos");
      const hdkey = bitcoin.bip32.fromSeed(seed, network);
      const path = core.addressNListToBIP32(msg.addressNList);

      let keypair = await bitcoin.ECPair.fromWIF(hdkey.derivePath(path).toWIF(), network);
      let privateKey = keypair.privateKey.toString("hex");
      let publicKey = keypair.publicKey.toString("hex");

      const wallet = {
        privateKey,
        publicKey,
      };

      const result = await txBuilder.sign(msg.tx, wallet, msg.sequence, msg.account_number, ATOM_CHAIN);

      return txBuilder.createSignedTx(msg.tx, result);
    }
  };
}
