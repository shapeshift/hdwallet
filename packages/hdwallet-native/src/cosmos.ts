import * as core from "@shapeshiftoss/hdwallet-core";
import txBuilder from "cosmos-tx-builder";
import * as bitcoin from "bitcoinjs-lib";
import { NativeHDWalletBase } from "./native";
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

export function MixinNativeCosmosWallet<TBase extends core.Constructor<NativeHDWalletBase>>(Base: TBase) {
  return class MixinNativeCosmosWallet extends Base {
    _supportsCosmos = true;

    #cosmosSeed: Buffer;

    async cosmosInitializeWallet(mnemonic: string): Promise<void> {
      this.#cosmosSeed = await mnemonicToSeed(mnemonic);
    }

    cosmosWipe(): void {
      this.#cosmosSeed = undefined;
    }

    cosmosGetKeyPair(addressNList: core.BIP32Path): bitcoin.ECPairInterface {
      return this.needsMnemonic(!!this.#cosmosSeed, () => {
        const network = getNetwork("cosmos");
        const wallet = bitcoin.bip32.fromSeed(this.#cosmosSeed, network);
        const path = core.addressNListToBIP32(addressNList);
        return bitcoin.ECPair.fromWIF(wallet.derivePath(path).toWIF(), network);
      });
    }

    bech32ify(address: ArrayLike<number>, prefix: string): string {
      const words = toWords(address);
      return encode(prefix, words);
    }

    createCosmosAddress(publicKey: string) {
      const message = SHA256(CryptoJS.enc.Hex.parse(publicKey));
      const hash = RIPEMD160(message as any).toString();
      const address = Buffer.from(hash, `hex`);
      return this.bech32ify(address, `cosmos`);
    }

    async cosmosGetAddress(msg: core.CosmosGetAddress): Promise<string> {
      const keyPair = this.cosmosGetKeyPair(msg.addressNList);
      return this.createCosmosAddress(keyPair.publicKey.toString("hex"));
    }

    async cosmosSignTx(msg: core.CosmosSignTx): Promise<core.CosmosSignedTx> {
      const ATOM_CHAIN = "cosmoshub-3";
      const keyPair = this.cosmosGetKeyPair(msg.addressNList);

      const wallet = {
        privateKey: keyPair.privateKey.toString("hex"),
        publicKey: keyPair.publicKey.toString("hex"),
      };

      const result = await txBuilder.sign(msg.tx, wallet, msg.sequence, msg.account_number, ATOM_CHAIN);

      return txBuilder.createSignedTx(msg.tx, result);
    }
  };
}
