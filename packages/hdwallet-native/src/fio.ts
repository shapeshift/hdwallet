import * as core from "@shapeshiftoss/hdwallet-core";
import * as fio from "fiosdk-offline";
import fetch, { RequestInfo, RequestInit } from "node-fetch";
import { NativeHDWalletBase } from "./native";
import { Fio as fiojs } from "@fioprotocol/fiojs"; // TODO use our forked fioSdk instead of fiojs
import { TextEncoder, TextDecoder } from "web-encoding";
import * as Isolation from "./crypto/isolation";

const fetchJson = async (uri: RequestInfo, opts?: RequestInit) => {
  return fetch(uri, opts);
};

function getKeyPair(seed: Isolation.BIP32.SeedInterface, addressNList: number[]) {
  let out = seed.toMasterKey()
  addressNList.forEach(x => {
    out = out.derive(x);
  });
  if (typeof out["ecdh"] !== "function") throw new Error("fio requires keys that implement ECDH");
  return new Isolation.Adapters.FIO(out as typeof out & Isolation.SecP256K1.ECDHKeyInterface);
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
    #seed: Isolation.BIP32.SeedInterface;

    async fioInitializeWallet(seed: Buffer | Isolation.BIP32.SeedInterface): Promise<void> {
      this.#seed = (seed instanceof Buffer ? new Isolation.BIP32.Seed(seed) : seed);
    }

    fioWipe(): void {
      this.#seed = undefined;
    }

    async getFioSdk(addressNList: core.BIP32Path): Promise<fio.FIOSDK> {
      return this.needsMnemonic(!!this.#seed, async () => {
        let key = getKeyPair(this.#seed, addressNList);
        return new fio.FIOSDK(key as any, key.publicKey, this.baseUrl, fetchJson);
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

    async fioEncryptRequestContent(msg: core.FioRequestContent & {iv?: Uint8Array}): Promise<string> {
      return this.needsMnemonic(!!this.#seed, async () => {
        const privateKey = getKeyPair(this.#seed, msg.addressNList);
        const sharedCipher = fiojs.createSharedCipher({
          privateKey,
          publicKey: msg.publicKey,
          textEncoder: new TextEncoder(),
          textDecoder: new TextDecoder(),
        });
        return sharedCipher.encrypt(msg.contentType, msg.content, msg.iv && Buffer.from(msg.iv));
      });
    }

    async fioDecryptRequestContent(msg: core.FioRequestContent): Promise<any> {
      return this.needsMnemonic(!!this.#seed, async () => {
        const privateKey = getKeyPair(this.#seed, msg.addressNList);
        const sharedCipher = fiojs.createSharedCipher({
          privateKey,
          publicKey: msg.publicKey,
          textEncoder: new TextEncoder(),
          textDecoder: new TextDecoder(),
        });
        return sharedCipher.decrypt(msg.contentType, JSON.stringify(msg.content));
      });
    }
  };
}
