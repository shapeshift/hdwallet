import * as core from "@bithighlander/hdwallet-core";

const fio = require('@fioprotocol/fiosdk');

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

export function MixinNativeFioWallet<TBase extends core.Constructor>(Base: TBase) {
  return class MixinNativeFioWallet extends Base {
    _supportsFio = true;
    #seed = "";

    fioInitializeWallet(seed: string): void {
      this.#seed = seed;
    }

    async fioGetAddress(msg: any): Promise<string> {
      const privateKeyRes = await fio.FIOSDK.createPrivateKeyMnemonic(this.#seed)
      const publicKeyRes = fio.FIOSDK.derivedPublicKey(privateKeyRes.fioKey)
      return publicKeyRes.publicKey;
    }

    async fioSignTx(msg: any): Promise<any> {


      let sig = {
        serialized: "",
        fioFormSig: "",
      };

      return sig;
    }
  };
}
