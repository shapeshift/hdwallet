import * as fioSdk from "@fioprotocol/fiojs"; // TODO use our forked fioSdk instead of fiojs
import * as core from "@shapeshiftoss/hdwallet-core";
import * as fio from "fiosdk-offline";
import fetch, { RequestInfo, RequestInit } from "node-fetch";
import { TextEncoder, TextDecoder } from "web-encoding";

import { NativeHDWalletBase } from "./native";
import * as Isolation from "./crypto/isolation";

const fetchJson = async (uri: RequestInfo, opts?: RequestInit) => {
  return fetch(uri, opts);
};

function getKeyPair(seed: Isolation.BIP32.SeedInterface, addressNList: number[]) {
  const out = addressNList.reduce((a, x) => a.derive(x), seed.toMasterKey());
  if (!Isolation.BIP32.nodeSupportsECDH(out)) throw new Error("fio requires keys that implement ECDH");
  return new Isolation.Adapters.FIO(out);
}

export function MixinNativeFioWalletInfo<TBase extends core.Constructor<core.HDWalletInfo>>(Base: TBase) {
  return class MixinNativeFioWalletInfo extends Base implements core.FioWalletInfo {
    readonly _supportsFioInfo = true;

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

    fioNextAccountPath(msg: core.FioAccountPath): core.FioAccountPath | undefined {
      // Only support one account for now (like portis).
      // the fioers library supports paths so it shouldnt be too hard if we decide multiple accounts are needed
      return undefined;
    }
  };
}

export function MixinNativeFioWallet<TBase extends core.Constructor<NativeHDWalletBase>>(Base: TBase) {
  return class MixinNativeFioWallet extends Base {
    readonly _supportsFio = true;
    baseUrl = "https://fio.eu.eosamsterdam.net/v1/";
    #seed: Isolation.BIP32.SeedInterface | undefined;

    async fioInitializeWallet(seed: Buffer | Isolation.BIP32.SeedInterface): Promise<void> {
      this.#seed = (seed instanceof Buffer ? new Isolation.BIP32.Seed(seed) : seed);
    }

    fioWipe(): void {
      this.#seed = undefined;
    }

    async getFioSdk(addressNList: core.BIP32Path): Promise<fio.FIOSDK | null> {
      return this.needsMnemonic(!!this.#seed, async () => {
        let key = getKeyPair(this.#seed!, addressNList);
        return new fio.FIOSDK(key as any, key.publicKey, this.baseUrl, fetchJson);
      });
    }

    async fioGetAddress(msg: core.FioGetAddress): Promise<string | null> {
      const sdk = await this.getFioSdk(msg.addressNList);
      return sdk?.getFioPublicKey() ?? null;
    }

    async fioSignTx(msg: core.FioSignTx): Promise<core.FioSignedTx | null> {
      const sdk = await this.getFioSdk(msg.addressNList);
      if (!sdk) return null;

      const account = msg.actions[0].account;
      const action = msg.actions[0].name;
      const data = msg.actions[0].data;
      if (!account || !action || !data) throw new Error("account, name, and data required");

      const res = await sdk.prepareTransaction(account, action, data);

      return {
        serialized: res.packed_trx,
        signature: res.signatures[0],
      };
    }

    async fioEncryptRequestContent(msg: core.FioRequestContent & {iv?: Uint8Array}): Promise<string | null> {
      return this.needsMnemonic(!!this.#seed, async () => {
        const privateKey = getKeyPair(this.#seed!, msg.addressNList);
        const sharedCipher = fioSdk.Fio.createSharedCipher({
          privateKey,
          publicKey: msg.publicKey,
          textEncoder: new TextEncoder(),
          textDecoder: new TextDecoder(),
        });
        return sharedCipher.encrypt(msg.contentType, msg.content, msg.iv && Buffer.from(msg.iv));
      });
    }

    async fioDecryptRequestContent(msg: core.FioRequestContent): Promise<any | null> {
      return this.needsMnemonic(!!this.#seed, async () => {
        const privateKey = getKeyPair(this.#seed!, msg.addressNList);
        const sharedCipher = fioSdk.Fio.createSharedCipher({
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
