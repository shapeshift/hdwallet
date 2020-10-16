import { addressNListToBIP32 } from "@shapeshiftoss/hdwallet-core";
import * as core from "@shapeshiftoss/hdwallet-core";
import { BIP32Interface } from "bitcoinjs-lib";
import * as bitcoin from "bitcoinjs-lib";
import * as fio from "fiosdk-offline";
import fetch, { RequestInfo, RequestInit } from "node-fetch";
import { NativeHDWalletBase } from "./native";
import { Fio as fiojs } from "@fioprotocol/fiojs"; // TODO use our forked fioSdk instead of fiojs
import { TextDecoder as TextDecoderNode, TextEncoder as TextEncoderNode } from "util";
import { TextDecoder as TextDecoderWeb, TextEncoder as TextEncoderWeb } from "text-encoding";

const fetchJson = async (uri: RequestInfo, opts?: RequestInit) => {
  return fetch(uri, opts);
};

const getTextEncoderDecoder = () => {
  return {
    textDecoder: typeof window === "undefined" ? new TextDecoderNode() : new TextDecoderWeb(),
    textEncoder: typeof window === "undefined" ? new TextEncoderNode() : new TextEncoderWeb(),
  };
};

function getKeyPair(seed: BIP32Interface, addressNList: number[]) {
  const wif = require("wif");
  const path = addressNListToBIP32(addressNList);
  const key = seed.derivePath(path).privateKey;
  const privateKey = wif.encode(128, key, false);
  const { publicKey } = fio.FIOSDK.derivedPublicKey(privateKey);

  return { privateKey, publicKey };
}

export function MixinNativeFioWalletInfo<TBase extends core.Constructor>(Base: TBase) {
  return class MixinNativeFioWalletInfo extends Base implements core.FioWalletInfo {
    _supportsFioInfo = true;

    async fioSupportsNetwork(): Promise<boolean> {
      return true;
    }

    async fioSupportsSecureTransfer(): Promise<boolean> {
      return false;
    }

    fioSupportsNativeShapeShift(): boolean {
      return false;
    }

    fioGetAccountPaths(msg: core.FioGetAccountPaths): Array<core.FioAccountPath> {
      return [
        {
          addressNList: [0x80000000 + 44, 0x80000000 + 235, 0x80000000 + msg.accountIdx, 0, 0],
        },
      ];
    }

    fioNextAccountPath(msg: core.FioAccountPath): core.FioAccountPath {
      // Only support one account for now (like portis).
      // the fioers library supports paths so it shouldnt be too hard if we decide multiple accounts are needed
      return undefined;
    }
  };
}

export function MixinNativeFioWallet<TBase extends core.Constructor<NativeHDWalletBase>>(Base: TBase) {
  return class MixinNativeFioWallet extends Base {
    _supportsFio = true;
    baseUrl = "https://fio.eu.eosamsterdam.net/v1/";
    #wallet: BIP32Interface;

    async fioInitializeWallet(seed: Buffer): Promise<void> {
      this.#wallet = bitcoin.bip32.fromSeed(seed);
    }

    async getFioSdk(addressNList: core.BIP32Path): Promise<fio.FIOSDK> {
      return this.needsMnemonic(!!this.#wallet, async () => {
        const { privateKey, publicKey } = getKeyPair(this.#wallet, addressNList);
        return new fio.FIOSDK(privateKey, publicKey, this.baseUrl, fetchJson);
      });
    }

    async fioGetAddress(msg: core.FioGetAddress): Promise<string> {
      const sdk = await this.getFioSdk(msg.addressNList);
      return sdk.getFioPublicKey();
    }

    async fioSignTx(msg: core.FioSignTx): Promise<core.FioSignedTx> {
      const sdk = await this.getFioSdk(msg.addressNList);

      const account: fio.FioActionParameters.FioActionAccount = msg.actions[0].account;
      const action: fio.FioActionParameters.FioActionName = msg.actions[0].name;
      const data: fio.FioActionParameters.FioActionData = msg.actions[0].data;

      const res = await sdk.prepareTransaction(account, action, data);

      return {
        serialized: res.packed_trx,
        signature: res.signatures[0],
      };
    }

    async fioEncryptRequestContent(msg: core.FioRequestContent): Promise<string> {
      const { textEncoder, textDecoder } = getTextEncoderDecoder();

      return this.needsMnemonic(!!this.#wallet, async () => {
        const { privateKey } = getKeyPair(this.#wallet, msg.addressNList);
        const sharedCipher = fiojs.createSharedCipher({
          privateKey,
          publicKey: msg.publicKey,
          textEncoder,
          textDecoder,
        });
        return sharedCipher.encrypt(msg.contentType, msg.content);
      });
    }

    async fioDecryptRequestContent(msg: core.FioRequestContent): Promise<any> {
      const { textEncoder, textDecoder } = getTextEncoderDecoder();

      return this.needsMnemonic(!!this.#wallet, async () => {
        const { privateKey } = getKeyPair(this.#wallet, msg.addressNList);
        const sharedCipher = fiojs.createSharedCipher({
          privateKey,
          publicKey: msg.publicKey,
          textEncoder,
          textDecoder,
        });
        return sharedCipher.decrypt(msg.contentType, JSON.stringify(msg.content));
      });
    }
  };
}
