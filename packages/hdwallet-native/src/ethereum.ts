import * as hdNode from "@shapeshiftoss/ethers-hdnode";
import * as core from "@shapeshiftoss/hdwallet-core";
import txDecoder from "ethereum-tx-decoder";
import * as ethers from "@shapeshiftoss/ethers";
import _ from "lodash";

import { NativeHDWalletBase } from "./native";
import * as Isolation from "./crypto/isolation";

export function MixinNativeETHWalletInfo<TBase extends core.Constructor<core.HDWalletInfo>>(Base: TBase) {
  return class MixinNativeETHWalletInfo extends Base implements core.ETHWalletInfo {
    readonly _supportsETHInfo = true;

    async ethSupportsNetwork(): Promise<boolean> {
      return true;
    }

    async ethSupportsSecureTransfer(): Promise<boolean> {
      return false;
    }

    ethSupportsNativeShapeShift(): boolean {
      return false;
    }

    ethGetAccountPaths(msg: core.ETHGetAccountPath): Array<core.ETHAccountPath> {
      const slip44 = core.slip44ByCoin(msg.coin);
      if (slip44 === undefined) return [];
      return [
        {
          addressNList: [0x80000000 + 44, 0x80000000 + slip44, 0x80000000 + msg.accountIdx, 0, 0],
          hardenedPath: [0x80000000 + 44, 0x80000000 + slip44, 0x80000000 + msg.accountIdx],
          relPath: [0, 0],
          description: "Native",
        },
      ];
    }

    ethNextAccountPath(msg: core.ETHAccountPath): core.ETHAccountPath | undefined {
      // Only support one account for now (like portis).
      // the ethers library supports paths so it shouldnt be too hard if we decide multiple accounts are needed
      return undefined;
    }
  };
}

export function MixinNativeETHWallet<TBase extends core.Constructor<NativeHDWalletBase>>(Base: TBase) {
  return class MixinNativeETHWallet extends Base {
    readonly _supportsETH = true;

    #ethWallet: ethers.Wallet | undefined;

    async ethInitializeWallet(seed: Isolation.Core.BIP32.Seed): Promise<void> {
      const isolatedSigner = new Isolation.Adapters.BIP32(seed.toMasterKey()).derivePath(hdNode.defaultPath);
      this.#ethWallet = new ethers.Wallet(new Isolation.Adapters.Ethereum(isolatedSigner));
    }

    ethWipe() {
      this.#ethWallet = undefined;
    }

    async ethGetAddress(msg: core.ETHGetAddress): Promise<string | null> {
      if (!_.isEqual(msg.addressNList, core.bip32ToAddressNList("m/44'/60'/0'/0/0"))) throw new Error("path not supported");
      return this.needsMnemonic(!!this.#ethWallet, () => this.#ethWallet!.getAddress());
    }

    async ethSignTx(msg: core.ETHSignTx): Promise<core.ETHSignedTx | null> {
      return this.needsMnemonic(!!this.#ethWallet, async () => {
        const result = await this.#ethWallet!.signTransaction({
          to: msg.to,
          from: await this.#ethWallet!.getAddress(),
          nonce: msg.nonce,
          gasLimit: msg.gasLimit,
          gasPrice: msg.gasPrice,
          data: msg.data,
          value: msg.value,
          chainId: msg.chainId,
        });
        const decoded = txDecoder.decodeTx(result);
        return {
          v: decoded.v,
          r: decoded.r,
          s: decoded.s,
          serialized: result,
        };
      });
    }

    async ethSignMessage(msg: core.ETHSignMessage): Promise<core.ETHSignedMessage | null> {
      return this.needsMnemonic(!!this.#ethWallet, async () => {
        const result = await this.#ethWallet!.signMessage(msg.message);
        return {
          address: await this.#ethWallet!.getAddress(),
          signature: result,
        };
      });
    }

    async ethVerifyMessage(msg: core.ETHVerifyMessage): Promise<boolean> {
      if (!msg.signature.startsWith("0x")) msg.signature = `0x${msg.signature}`;
      const signingAddress = ethers.utils.verifyMessage(msg.message, msg.signature);
      return signingAddress === msg.address;
    }
  };
}
