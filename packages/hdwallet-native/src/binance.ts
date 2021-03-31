import * as core from "@shapeshiftoss/hdwallet-core";
import { BIP32Interface } from "bitcoinjs-lib";
import { BncClient } from "bnb-javascript-sdk-nobroadcast";
import * as bitcoin from "bitcoinjs-lib";
import { NativeHDWalletBase } from "./native";
import { getNetwork } from "./networks";
import { toWords, encode } from "bech32";
import CryptoJS, { RIPEMD160, SHA256 } from "crypto-js";
import util from "./util";

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
      const slip44 = core.slip44ByCoin("Binance")
      return [
        {
          addressNList: [0x80000000 + 44, 0x80000000 + slip44, 0x80000000 + msg.accountIdx, 0, 0],
        },
      ];
    }

    binanceNextAccountPath(msg: core.BinanceAccountPath): core.BinanceAccountPath {
      // Only support one account for now (like portis).
      return undefined;
    }
  };
}

export function MixinNativeBinanceWallet<TBase extends core.Constructor<NativeHDWalletBase>>(Base: TBase) {
  return class MixinNativeBinanceWallet extends Base {
    _supportsBinance = true;

    #wallet: BIP32Interface;

    async binanceInitializeWallet(seed: Buffer): Promise<void> {
      const network = getNetwork("binance");
      this.#wallet = bitcoin.bip32.fromSeed(seed, network);
    }

    binanceWipe(): void {
      this.#wallet = undefined;
    }

    bech32ify(address: ArrayLike<number>, prefix: string): string {
      const words = toWords(address);
      return encode(prefix, words);
    }

    createBinanceAddress(publicKey: string) {
      const message = SHA256(CryptoJS.enc.Hex.parse(publicKey));
      const hash = RIPEMD160(message as any).toString();
      const address = Buffer.from(hash, `hex`);
      return this.bech32ify(address, `bnb`);
    }

    async binanceGetAddress(msg: core.BinanceGetAddress): Promise<string> {
      return this.needsMnemonic(!!this.#wallet, async () => {
        return this.createBinanceAddress(util.getKeyPair(this.#wallet, msg.addressNList, "binance").publicKey);
      });
    }

    async binanceSignTx(msg: core.BinanceSignTx): Promise<core.BinanceSignedTx> {
      return this.needsMnemonic(!!this.#wallet, async () => {
        const { privateKey } = util.getKeyPair(this.#wallet, msg.addressNList, "binance");

        const client = new BncClient("https://dex.binance.org"); // broadcast not used but available
        await client.chooseNetwork("mainnet");
        await client.setPrivateKey(privateKey, Number.isInteger(Number(msg.account_number)));
        await client.initChain();

        const addressFrom = msg.tx?.msgs?.[0]?.inputs?.[0]?.address;
        const addressFromVerify = client.getClientKeyAddress()
        if (addressFrom !== addressFromVerify) {
          throw Error("Invalid permissions to sign for address")
        }
        const addressTo = msg.tx.msgs[0].outputs[0].address;
        const amount = (msg.tx.msgs[0].inputs[0].coins[0].amount).toString();
        const asset = "BNB";
        const memo = msg.tx.memo;

        const result: any = await client.transfer(addressFrom, addressTo, amount, asset, memo, null);
        const pub_key = result.signatures[0].pub_key.toString("base64");
        const signature = Buffer.from(result.signatures[0].signature, "base64").toString("base64");

        return {
          account_number: result.account,
          chain_id: result.chain_id,
          data: null,
          memo: result.memo,
          msgs: result.msgs,
          signatures: {
            pub_key,
            signature,
          },
          serialized: result.serialized,
        };
      });
    }
  };
}
