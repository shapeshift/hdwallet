import * as core from "@keepkey/hdwallet-core";
import * as ethers from "ethers";

import * as Isolation from "./crypto/isolation";
import SignerAdapter from "./crypto/isolation/adapters/ethereum";
import { NativeHDWalletBase } from "./native";
// import { addressNListToBIP32 } from "./utils";

export function MixinNativeETHWalletInfo<TBase extends core.Constructor<core.HDWalletInfo>>(Base: TBase) {
  // eslint-disable-next-line @typescript-eslint/no-shadow
  return class MixinNativeETHWalletInfo extends Base implements core.ETHWalletInfo {
    readonly _supportsETHInfo = true;
    _chainId = 1;

    async ethSupportsNetwork(): Promise<boolean> {
      return true;
    }

    async ethSupportsSecureTransfer(): Promise<boolean> {
      return false;
    }

    ethSupportsNativeShapeShift(): boolean {
      return false;
    }

    async ethSupportsEIP1559(): Promise<boolean> {
      return true;
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

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    ethNextAccountPath(msg: core.ETHAccountPath): core.ETHAccountPath | undefined {
      // Only support one account for now (like portis).
      // the ethers library supports paths so it shouldnt be too hard if we decide multiple accounts are needed
      return undefined;
    }
  };
}

export function MixinNativeETHWallet<TBase extends core.Constructor<NativeHDWalletBase>>(Base: TBase) {
  // eslint-disable-next-line @typescript-eslint/no-shadow
  return class MixinNativeETHWallet extends Base {
    readonly _supportsETH = true;

    #ethSigner: SignerAdapter | undefined;

    async ethInitializeWallet(masterKey: Isolation.Core.BIP32.Node): Promise<void> {
      const nodeAdapter = await Isolation.Adapters.BIP32.create(masterKey);

      this.#ethSigner = new SignerAdapter(nodeAdapter);
    }

    ethWipe() {
      this.#ethSigner = undefined;
    }

    async ethGetAddress(msg: core.ETHGetAddress): Promise<string | null> {
      if (msg.addressNList.length < 5) {
        throw new Error(`path not supported length: ${msg.addressNList.length}`);
      }

      return this.needsMnemonic(!!this.#ethSigner, () => {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        return this.#ethSigner!.getAddress(msg.addressNList);
      });
    }

    async ethSignTx(msg: core.ETHSignTx): Promise<core.ETHSignedTx | null> {
      return this.needsMnemonic(!!this.#ethSigner, async () => {
        const utx = {
          to: msg.to,
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          from: await this.#ethSigner!.getAddress(msg.addressNList),
          nonce: msg.nonce,
          gasLimit: msg.gasLimit,
          data: msg.data,
          value: msg.value,
          chainId: msg.chainId,
        };
        const result: string = msg.maxFeePerGas
          ? // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            await this.#ethSigner!.signTransaction(
              {
                ...utx,
                maxFeePerGas: msg.maxFeePerGas,
                maxPriorityFeePerGas: msg.maxPriorityFeePerGas,
                type: core.ETHTransactionType.ETH_TX_TYPE_EIP_1559,
              },
              msg.addressNList
            )
          : // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            await this.#ethSigner!.signTransaction(
              {
                ...utx,
                gasPrice: msg.gasPrice,
                type: core.ETHTransactionType.ETH_TX_TYPE_LEGACY,
              },
              msg.addressNList
            );

        const decoded = ethers.utils.parseTransaction(result);
        return {
          v: core.mustBeDefined(decoded.v),
          r: core.mustBeDefined(decoded.r),
          s: core.mustBeDefined(decoded.s),
          serialized: result,
        };
      });
    }

    async ethSignMessage(msg: core.ETHSignMessage): Promise<core.ETHSignedMessage | null> {
      return this.needsMnemonic(!!this.#ethSigner, async () => {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const result = await this.#ethSigner!.signMessage(msg.message, msg.addressNList);
        return {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          address: await this.#ethSigner!.getAddress(msg.addressNList),
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
