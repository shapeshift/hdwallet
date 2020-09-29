import * as core from "@shapeshiftoss/hdwallet-core";
import * as fio from "fiosdk-offline";
//const fio = require("fiosdk-offline");
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

export function MixinNativeFioWallet<TBase extends core.Constructor>(Base: TBase) {
  return class MixinNativeFioWallet extends Base {
    _supportsFio = true;
    baseUrl = "https://fio.eu.eosamsterdam.net/v1/";
    #seed = "";
    #privateKey = "";
    #publicKey = "";
    #fioSdk: any;

    async fioInitializeWallet(seed: string): Promise<void> {
      this.#seed = seed;
      await this.fioSDKInit(seed);
    }

    async fioGetAddress(msg: core.FioGetAddress): Promise<string> {
      const path = core.addressNListToBIP32(msg.addressNList);
      await this.fioSDKInit(this.#seed, path);
      return this.#publicKey;
    }

    async fioSignTx(msg: core.FioSignTx): Promise<core.FioSignedTx> {
      const account: string = msg.actions[0].account;
      const action: string = msg.actions[0].name;
      const data: core.Fio.FioTxActionData = msg.actions[0].data;
      if (!this.#fioSdk) {
        // Throw error. fioInitializeWallet has not been called.
      }
      const res = await this.#fioSdk.prepareTransaction(account, action, data);
      if (!res.signatures || !res.packed_trx) {
        // Throw error. Transaction is invalid.
      }
      const sig = {
        serialized: res.packed_trx, // Serialized hexadecimal transaction
        signature: res.signatures[0], //
      };

      return sig;
    }

    async fioSDKInit(seed: string, path?: string) {
      const privateKeyRes = await fio.FIOSDK.createPrivateKeyMnemonic(seed, path);
      this.#privateKey = privateKeyRes.fioKey;
      const publicKeyRes = fio.FIOSDK.derivedPublicKey(this.#privateKey);
      this.#publicKey = publicKeyRes.publicKey;
      this.#fioSdk = new fio.FIOSDK(this.#privateKey, this.#publicKey, this.baseUrl, fetchJson);
      //console.log("privKey", this.#privateKey);
      //console.log("pubKey", this.#publicKey);
    }
  };
}
