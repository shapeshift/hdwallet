import * as core from "@bithighlander/hdwallet-core";

import { addressNListToBIP32, BinanceSignTx, BinanceSignedTx } from "@bithighlander/hdwallet-core";

import BncClient from "bnb-javascript-sdk-nobroadcast";
import * as bitcoin from "bitcoinjs-lib";
import { getNetwork } from "./networks";
import { mnemonicToSeed } from "bip39";
import { toWords, encode } from "bech32";
import CryptoJS, { RIPEMD160, SHA256 } from "crypto-js";

function bech32ify(address, prefix) {
  const words = toWords(address);
  return encode(prefix, words);
}

function createBNBAddress(publicKey) {
  const message = SHA256(CryptoJS.enc.Hex.parse(publicKey.toString(`hex`)));
  const hash = RIPEMD160(message as any).toString();
  const address = Buffer.from(hash, `hex`);
  const bnbAddress = bech32ify(address, `bnb`);
  return bnbAddress;
}

export function MixinNativeBinanceWalletInfo<TBase extends core.Constructor>(Base: TBase) {
  return class MixinNativeBinanceWalletInfo extends Base implements core.BinanceWalletInfo {
    _supportsBinanceInfo = true;

    async binanceSupportsNetwork(): Promise<boolean> {
      return true;
    }

    async binanceSupportsSecureTransfer(): Promise<boolean> {
      return false;
    }

    binanceSupportsNativeShapeShift(): boolean {
      return false;
    }

    binanceGetAccountPaths(msg: core.BinanceGetAccountPaths): Array<core.BinanceAccountPath> {
      return [
        {
          addressNList: [0x80000000 + 44, 0x80000000 + 117, 0x80000000 + msg.accountIdx, 0, 0],
          // hardenedPath: [0x80000000 + 44, 0x80000000 + core.slip44ByCoin(msg.coin), 0x80000000 + msg.accountIdx],
          // relPath: [0, 0],
          // description: "Native",
        },
      ];
    }

    binanceNextAccountPath(msg: core.BinanceAccountPath): core.BinanceAccountPath {
      // Only support one account for now (like portis).
      return undefined;
    }
  };
}

export function MixinNativeBinanceWallet<TBase extends core.Constructor>(Base: TBase) {
  return class MixinNativeBinanceWallet extends Base {
    _supportsBinance = true;
    #seed = "";

    binanceInitializeWallet(seed: string): void {
      //get
      this.#seed = seed;
    }

    bech32ify(address: ArrayLike<number>, prefix: string): string {
      const words = toWords(address);
      return encode(prefix, words);
    }

    createBinanceAddress(publicKey: string) {
      const message = SHA256(CryptoJS.enc.Hex.parse(publicKey));
      const hash = RIPEMD160(message as any).toString();
      const address = Buffer.from(hash, `hex`);
      const cosmosAddress = this.bech32ify(address, `bnb`);
      return cosmosAddress;
    }

    async binanceGetAddress(msg: core.BinanceGetAddress): Promise<string> {
      const seed = await mnemonicToSeed(this.#seed);

      const network = getNetwork("bitcoin");
      const wallet = bitcoin.bip32.fromSeed(seed, network);
      const path = core.addressNListToBIP32(msg.addressNList);
      const keypair = await bitcoin.ECPair.fromWIF(wallet.derivePath(path).toWIF(), network);
      const address = this.createBinanceAddress(keypair.publicKey.toString("hex"));

      return address;
    }

    async binanceSignTx(msg: BinanceSignTx, mnemonic: string, xpriv: string, from: string): Promise<BinanceSignedTx> {
      const seed = await mnemonicToSeed(this.#seed);

      const network = getNetwork("cosmos");
      const hdkey = bitcoin.bip32.fromSeed(seed, network);
      const path = core.addressNListToBIP32(msg.addressNList);

      let keypair = await bitcoin.ECPair.fromWIF(hdkey.derivePath(path).toWIF(), network);
      let privateKey = keypair.privateKey.toString("hex");

      //use sdk to build Amino encoded hex transaction
      const client = new BncClient("https://dex.binance.org"); //broadcast not used but available
      await client.chooseNetwork("mainnet");
      await client.setPrivateKey(privateKey);
      await client.initChain();

      //let fromAddress = msg
      const addressFrom = msg.tx.msgs[0].inputs[0].address;
      const addressTo = msg.tx.msgs[0].outputs[0].address;
      const amount = msg.tx.msgs[0].inputs[0].coins[0].amount;
      const asset = "BNB";
      const message = ""; //TODO do memo's

      const result = await client.transfer(addressFrom, addressTo, amount, asset, message, null);

      let rawHex = result.serialize();
      const buffer = Buffer.from(rawHex, "hex");
      let txid = CryptoJS.createHash("sha256").update(buffer).digest("hex").toUpperCase();

      const output: BinanceSignedTx = {
        account_number: result.account,
        chain_id: result.chain_id,
        data: null,
        memo: result.memo,
        msgs: result.msgs,
        signatures: {
          pub_key: result.signatures[0].pub_key,
          signature: result.signatures[0].signature,
        },
      };

      return output;
    }
  };
}
