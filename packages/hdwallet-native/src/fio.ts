/*


 */

import * as core from "@shapeshiftoss/hdwallet-core";
import { NativeHDWalletBase } from "./native";

const fio = require("@fioprotocol/fiosdk");
const fetch = require("node-fetch");

const fetchJson = async (uri, opts = {}) => {
  return fetch(uri, opts);
};

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

    fioGetAccountPaths(msg: any): Array<core.FioAccountPath> {
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
    baseUrl = "https://fio.eu.eosamsterdam.net/v1/"; //TODO fork/stop using network in sdk
    #seed = "";
    #privateKey = "";
    #publicKey = "";
    #fioSdk;

    async fioInitializeWallet(seed: string): Promise<boolean> {
      this.#seed = seed;
      const privateKeyRes = await fio.FIOSDK.createPrivateKeyMnemonic(this.#seed);
      const publicKeyRes = fio.FIOSDK.derivedPublicKey(privateKeyRes.fioKey);
      return true;
    }

    async fioGetAddress(msg: any): Promise<string> {
      const privateKeyRes = await fio.FIOSDK.createPrivateKeyMnemonic(this.#seed);
      const publicKeyRes = fio.FIOSDK.derivedPublicKey(privateKeyRes.fioKey);
      return publicKeyRes.publicKey;
    }

    async fioGetPublicKey(msg: any): Promise<string> {
      const privateKeyRes = await fio.FIOSDK.createPrivateKeyMnemonic(this.#seed);
      const publicKeyRes = fio.FIOSDK.derivedPublicKey(privateKeyRes.fioKey);
      return publicKeyRes.publicKey;
    }

    async fioSignTx(msg: core.FioTx): Promise<any> {
      this.#privateKey = fio.FIOSDK.createPrivateKeyMnemonic(this.#seed).fioKey;
      this.#publicKey = fio.FIOSDK.derivedPublicKey(this.#privateKey);
      this.#fioSdk = new fio.FIOSDK(this.#privateKey, this.#publicKey, this.baseUrl, fetchJson);

      const account: string = msg.actions[0].account || "fio.token";
      const action: string = msg.actions[0].name || "fiotrnspubky";

      const data: core.Fio.FioTxActionData = msg.actions[0].data;
      if (!this.#fioSdk) {
        // Throw error. fioInitializeWallet has not been called.
      }
      const res = this.#fioSdk.prepareTransaction(account, action, data);
      if (!res.signatures || !res.packed_trx) {
        // Throw error. Transaction is invalid.
      }
      let sig = {
        serialized: res.packed_trx, // Serialized hexadecimal transaction
        signature: res.signatures[0], //
      };

      return sig;
    }
  };
}
