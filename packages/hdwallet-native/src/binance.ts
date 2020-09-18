import * as core from "@shapeshiftoss/hdwallet-core";
import BncClient from "bnb-javascript-sdk-nobroadcast";
import * as bitcoin from "bitcoinjs-lib";
import { NativeHDWalletBase } from "./native";
import { getNetwork } from "./networks";
import { mnemonicToSeed } from "bip39";
import { toWords, encode } from "bech32";
import CryptoJS, { RIPEMD160, SHA256 } from "crypto-js";

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
    #seed: Buffer;

    async binanceInitializeWallet(mnemonic: string): Promise<void> {
      this.#seed = await mnemonicToSeed(mnemonic);
    }

    binanceWipe(): void {
      this.#seed = undefined;
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
      return this.needsMnemonic(!!this.#seed, async () => {
        const network = getNetwork("binance");
        const master = bitcoin.bip32.fromSeed(this.#seed, network);
        const child = master.derivePath(core.addressNListToBIP32(msg.addressNList));
        return this.createBinanceAddress(child.publicKey.toString("hex"));
      });
    }

    async binanceSignTx(msg: core.BinanceSignTx): Promise<core.BinanceSignedTx> {
      return this.needsMnemonic(!!this.#seed, async () => {
        const network = getNetwork("binance");
        const master = bitcoin.bip32.fromSeed(this.#seed, network);
        const child = master.derivePath(core.addressNListToBIP32(msg.addressNList));
        const privateKey = child.privateKey.toString("hex");

        const accountNumber = !Number.isNaN(Number(msg.account_number)) ? Number(msg.account_number) : undefined;

        const client = new BncClient("https://dex.binance.org"); //broadcast not used but available
        client.chainId = msg.chain_id;
        client.setAccountNumber(accountNumber);
        await client.chooseNetwork("mainnet");
        await client.setPrivateKey(privateKey, !!accountNumber);
        await client.initChain();

        const addressFrom = msg.tx.msgs[0].inputs[0].address;
        const addressTo = msg.tx.msgs[0].outputs[0].address;
        const amount = msg.tx.msgs[0].inputs[0].coins[0].amount;
        const asset = "BNB";
        const memo = msg.tx.memo;
        const sequence = msg.sequence;

        const result = await client.transfer(addressFrom, addressTo, amount, asset, memo, sequence);
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
