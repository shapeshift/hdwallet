import * as fio from "@shapeshiftoss/fiosdk";
import * as core from "@shapeshiftoss/hdwallet-core";
import fetch, { RequestInfo, RequestInit } from "node-fetch";

import * as Isolation from "./crypto/isolation";
import { NativeHDWalletBase } from "./native";

const fetchJson = async (uri: RequestInfo, opts?: RequestInit) => {
  return fetch(uri, opts);
};

async function getKeyPair(masterKey: Isolation.Core.BIP32.Node, addressNList: number[]) {
  const out = await addressNList.reduce(async (a, x) => (await a).derive(x), Promise.resolve(masterKey));
  if (!Isolation.Core.BIP32.nodeSupportsECDH(out)) throw new Error("fio requires keys that implement ECDH");
  return await Isolation.Adapters.FIO.create(out);
}

export function MixinNativeFioWalletInfo<TBase extends core.Constructor<core.HDWalletInfo>>(Base: TBase) {
  // eslint-disable-next-line @typescript-eslint/no-shadow
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

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    fioNextAccountPath(msg: core.FioAccountPath): core.FioAccountPath | undefined {
      // Only support one account for now (like portis).
      // the fioers library supports paths so it shouldnt be too hard if we decide multiple accounts are needed
      return undefined;
    }
  };
}

export function MixinNativeFioWallet<TBase extends core.Constructor<NativeHDWalletBase>>(Base: TBase) {
  // eslint-disable-next-line @typescript-eslint/no-shadow
  return class MixinNativeFioWallet extends Base {
    readonly _supportsFio = true;
    baseUrl = "https://fio.eu.eosamsterdam.net/v1/";
    #masterKey: Isolation.Core.BIP32.Node | undefined;

    async fioInitializeWallet(masterKey: Isolation.Core.BIP32.Node): Promise<void> {
      this.#masterKey = masterKey;
    }

    fioWipe(): void {
      this.#masterKey = undefined;
    }

    async getFioSdk(addressNList: core.BIP32Path): Promise<fio.FIOSDK | null> {
      return this.needsMnemonic(!!this.#masterKey, async () => {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const key = await getKeyPair(this.#masterKey!, addressNList);
        const sdk = new fio.FIOSDK(key as any, key.publicKey, this.baseUrl, fetchJson);
        sdk.setSignedTrxReturnOption(true);
        return sdk;
      });
    }

    async fioGetAddress(msg: core.FioGetAddress): Promise<string | null> {
      const sdk = await this.getFioSdk(msg.addressNList);
      return sdk?.getFioPublicKey() ?? null;
    }

    async fioSignTx(msg: core.FioSignTx): Promise<core.FioSignedTx | null> {
      const sdk = await this.getFioSdk(msg.addressNList);
      if (!sdk) return null;

      const action = msg.actions[0];
      if (!action.account || !action.name || !action.data) throw new Error("account, name, and data required");

      let genericAction = "";
      let genericActionParams: Record<string, unknown> = {};
      switch (action.name) {
        case "addaddress": {
          genericAction = "addPublicAddresses";
          genericActionParams = {
            fioAddress: action.data.fio_address,
            publicAddresses: action.data.public_addresses,
            maxFee: action.data.max_fee,
            technologyProviderId: action.data.tpid,
          };
          break;
        }
        case "newfundsreq": {
          genericAction = "requestFunds";
          const payerPublicKey = (await sdk.getFioPublicAddress(action.data.payer_fio_address)).public_address;
          const decryptedContent = core.mustBeDefined(
            await this.fioDecryptRequestContent({
              contentType: core.Fio.ContentType.REQUEST,
              content: action.data.content,
              addressNList: msg.addressNList,
              publicKey: payerPublicKey,
            } as const)
          );
          genericActionParams = {
            payerFioAddress: action.data.payer_fio_address,
            payeeFioAddress: action.data.payee_fio_address,
            payeeTokenPublicAddress: decryptedContent.payee_public_address,
            amount: decryptedContent.amount,
            chainCode: decryptedContent.chain_code,
            tokenCode: decryptedContent.token_code,
            memo: decryptedContent.memo,
            maxFee: action.data.max_fee,
            payerFioPublicKey: null,
            technologyProviderId: action.data.tpid,
            hash: decryptedContent.hash,
            offlineUrl: decryptedContent.offline_url,
          };
          break;
        }
        case "recordobt": {
          genericAction = "recordObtData";
          const payeePublicKey = (await sdk.getFioPublicAddress(action.data.payee_fio_address)).public_address;
          const decryptedContent = core.mustBeDefined(
            await this.fioDecryptRequestContent({
              contentType: core.Fio.ContentType.OBT,
              content: action.data.content,
              addressNList: msg.addressNList,
              publicKey: payeePublicKey,
            } as const)
          );
          genericActionParams = {
            fioRequestId: action.data.fio_request_id ? Number(action.data.fio_request_id) : null,
            payerFioAddress: action.data.payer_fio_address,
            payeeFioAddress: action.data.payee_fio_address,
            payerTokenPublicAddress: decryptedContent.payer_public_address,
            payeeTokenPublicAddress: decryptedContent.payee_public_address,
            amount: decryptedContent.amount,
            chainCode: decryptedContent.chain_code,
            tokenCode: decryptedContent.token_code,
            status: decryptedContent.status,
            obtId: decryptedContent.obt_id,
            maxFee: action.data.max_fee,
            technologyProviderId: action.data.tpid,
            payeeFioPublicKey: null,
            memo: decryptedContent.memo,
            hash: decryptedContent.hash,
            offLineUrl: decryptedContent.offline_url,
          };
          break;
        }
        case "regaddress": {
          genericAction = "registerOwnerFioAddress";
          genericActionParams = {
            fioAddress: action.data.fio_address,
            ownerPublicKey: action.data.owner_fio_public_key,
            maxFee: action.data.max_fee,
            technologyProviderId: action.data.tpid,
          };
          break;
        }
        case "regdomain": {
          genericAction = "registerOwnerFioDomain";
          genericActionParams = {
            fioDomain: action.data.fio_domain,
            ownerPublicKey: action.data.owner_fio_public_key,
            maxFee: action.data.max_fee,
            technologyProviderId: action.data.tpid,
          };
          break;
        }
        case "rejectfndreq": {
          genericAction = "rejectFundsRequest";
          genericActionParams = {
            fioRequestId: Number(action.data.fio_request_id),
            maxFee: action.data.max_fee,
            technologyProviderId: action.data.tpid,
          };
          break;
        }
        case "renewaddress": {
          genericAction = "renewFioAddress";
          genericActionParams = {
            fioAddress: action.data.fio_address,
            maxFee: action.data.max_fee,
            technologyProviderId: action.data.tpid,
          };
          break;
        }
        case "renewdomain": {
          genericAction = "renewFioDomain";
          genericActionParams = {
            fioDomain: action.data.fio_domain,
            maxFee: action.data.max_fee,
            technologyProviderId: action.data.tpid,
          };
          break;
        }
        case "setdomainpub": {
          genericAction = "setFioDomainVisibility";
          genericActionParams = {
            fioDomain: action.data.fio_domain,
            isPublic: action.data.is_public,
            maxFee: action.data.max_fee,
            technologyProviderId: action.data.tpid,
          };
          break;
        }
        case "trnsfiopubky": {
          genericAction = "transferTokens";
          genericActionParams = {
            payeeFioPublicKey: action.data.payee_public_key,
            amount: action.data.amount,
            maxFee: action.data.max_fee,
            technologyProviderId: action.data.tpid,
          };
          break;
        }
        default:
          throw new Error(`unsupported FIO action: ${JSON.stringify(action)}`);
      }

      const res = await sdk.genericAction(genericAction, genericActionParams);

      return {
        serialized: res.packed_trx,
        signature: res.signatures[0],
      };
    }

    async fioEncryptRequestContent<T extends core.Fio.ContentType>(
      msg: core.FioEncryptRequestContentMsg<T>
    ): Promise<string | null> {
      return this.needsMnemonic(!!this.#masterKey, async () => {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const privateKey = await getKeyPair(this.#masterKey!, msg.addressNList);
        const sdk = core.mustBeDefined(await this.getFioSdk(msg.addressNList));
        return await sdk.transactions.getCipherContent(
          msg.contentType,
          msg.content,
          privateKey,
          msg.publicKey,
          msg.iv && Buffer.from(msg.iv)
        );
      });
    }

    async fioDecryptRequestContent<T extends core.Fio.ContentType>(
      msg: core.FioDecryptRequestContentMsg<T>
    ): Promise<core.Fio.Content<T> | null> {
      return this.needsMnemonic(!!this.#masterKey, async () => {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const privateKey = await getKeyPair(this.#masterKey!, msg.addressNList);
        const sdk = core.mustBeDefined(await this.getFioSdk(msg.addressNList));
        return await sdk.transactions.getUnCipherContent(
          msg.contentType,
          JSON.stringify(msg.content),
          privateKey,
          msg.publicKey
        );
      });
    }
  };
}
