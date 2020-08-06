import * as core from "@bithighlander/hdwallet-core";

import { addressNListToBIP32, BinanceSignTx, BinanceSignedTx } from "@bithighlander/hdwallet-core";

import BncClient from "bnb-javascript-sdk-nobroadcast";
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

function createBNBAddress(publicKey) {
  const message = CryptoJS.enc.Hex.parse(publicKey.toString(`hex`));
  const hash = ripemd160(sha256(message)).toString();
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

    async binanceGetAddress(msg: core.BinanceGetAddress): Promise<string> {
      const seed = await bip39.mnemonicToSeed(this.#seed);

      let mk = new HDKey.fromMasterSeed(Buffer.from(seed, "hex"));
      // expects bip32
      let path = addressNListToBIP32(msg.addressNList);

      mk = mk.derive(path);
      let publicKey = mk.publicKey;
      let address = createBNBAddress(publicKey);
      return address;
    }

    async binanceSignTx(msg: BinanceSignTx, mnemonic: string, xpriv: string, from: string): Promise<BinanceSignedTx> {
      const seed = await bip39.mnemonicToSeed(this.#seed);

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

      //verify from address match signing
      // let signingAddress = await createBNBAddress(publicKey)
      // console.log("signingAddress: ",signingAddress)
      // if(signingAddress !== msg.tx.msgs[0].inputs[0].address){
      //   throw Error("102: attempting to sign a transaction on the wrong address! sign: "+signingAddress+' from: '+msg.tx.msgs[0].inputs[0].address)
      // }

      //use sdk to build Amino encoded hex transaction
      const client = new BncClient("https://dex.binance.org"); //broadcast not used but available
      await client.chooseNetwork("mainnet");
      await client.setPrivateKey(privateKey);
      await client.initChain();

      //let fromAddress = msg
      let addressFrom = msg.tx.msgs[0].inputs[0].address;
      let addressTo = msg.tx.msgs[0].outputs[0].address;
      let amount = msg.tx.msgs[0].inputs[0].coins[0].amount;
      let asset = "BNB";
      let message = ""; //TODO do memo's

      console.log("pre-client: ", {
        addressFrom,
        addressTo,
        amount,
        asset,
        message,
      });

      let result = await client.transfer(addressFrom, addressTo, amount, asset, message, null);

      let rawHex = result.serialize();
      const buffer = Buffer.from(rawHex, "hex");
      let txid = "";

      let output: BinanceSignedTx = {
        account_number: result.account,
        chain_id: result.chain_id,
        data: null,
        memo: result.memo,
        msgs: result.msgs,
        //txid,
        //serialized:rawHex,
        signatures: {
          pub_key: result.signatures[0].pub_key,
          signature: result.signatures[0].signature,
        },
      };

      return output;
    }
  };
}
