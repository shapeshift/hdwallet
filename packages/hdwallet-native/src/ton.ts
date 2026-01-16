import * as core from "@shapeshiftoss/hdwallet-core";

import { Isolation } from "./crypto";
import { TonAdapter, TonTransactionParams } from "./crypto/isolation/adapters/ton";
import { NativeHDWalletBase } from "./native";

export function MixinNativeTonWalletInfo<TBase extends core.Constructor<core.HDWalletInfo>>(Base: TBase) {
  // eslint-disable-next-line @typescript-eslint/no-shadow
  return class MixinNativeTonWalletInfo extends Base implements core.TonWalletInfo {
    readonly _supportsTonInfo = true;

    tonGetAccountPaths(msg: core.TonGetAccountPaths): Array<core.TonAccountPath> {
      return core.tonGetAccountPaths(msg);
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    tonNextAccountPath(_msg: core.TonAccountPath): core.TonAccountPath | undefined {
      throw new Error("Method not implemented");
    }
  };
}

export function MixinNativeTonWallet<TBase extends core.Constructor<NativeHDWalletBase>>(Base: TBase) {
  // eslint-disable-next-line @typescript-eslint/no-shadow
  return class MixinNativeTonWallet extends Base {
    readonly _supportsTon = true;

    tonAdapter: TonAdapter | undefined;

    async tonInitializeWallet(ed25519MasterKey: Isolation.Core.Ed25519.Node): Promise<void> {
      const nodeAdapter = new Isolation.Adapters.Ed25519(ed25519MasterKey);
      this.tonAdapter = new TonAdapter(nodeAdapter);
    }

    tonWipe() {
      this.tonAdapter = undefined;
    }

    async tonGetAddress(msg: core.TonGetAddress): Promise<string | null> {
      return this.needsMnemonic(!!this.tonAdapter, () => {
        return this.tonAdapter!.getAddress(msg.addressNList);
      });
    }

    async tonSignTx(msg: core.TonSignTx): Promise<core.TonSignedTx | null> {
      return this.needsMnemonic(!!this.tonAdapter, async () => {
        if (msg.rawMessages && msg.rawMessages.length > 0) {
          const seqno = msg.seqno ?? 0;
          const expireAt = msg.expireAt ?? Math.floor(Date.now() / 1000) + 300;

          const bocBase64 = await this.tonAdapter!.createSignedRawTransferBoc(
            msg.rawMessages,
            seqno,
            expireAt,
            msg.addressNList
          );

          // signature is empty because TON embeds the signature inside the BOC (Bag of Cells).
          // The serialized field contains the complete signed transaction ready for broadcast.
          return {
            signature: "",
            serialized: bocBase64,
          };
        }

        if (!msg.message) {
          throw new Error("Either message or rawMessages must be provided");
        }

        const messageJson = new TextDecoder().decode(msg.message);
        let txParams: TonTransactionParams;

        try {
          txParams = JSON.parse(messageJson) as TonTransactionParams;
        } catch (error) {
          throw new Error(
            `Failed to parse TON transaction message: ${
              error instanceof Error ? error.message : String(error)
            }. Message: ${messageJson}`
          );
        }

        const bocBase64 = await this.tonAdapter!.createSignedTransferBoc(txParams, msg.addressNList);

        // signature is empty because TON embeds the signature inside the BOC (Bag of Cells).
        // The serialized field contains the complete signed transaction ready for broadcast.
        return {
          signature: "",
          serialized: bocBase64,
        };
      });
    }
  };
}
