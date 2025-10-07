import * as core from "@shapeshiftoss/hdwallet-core";
import { keccak256, parseTransaction, recoverAddress } from "ethers/lib/utils.js";

import * as Isolation from "./crypto/isolation";
import SignerAdapter from "./crypto/isolation/adapters/ethereum";
import { NativeHDWalletBase } from "./native";

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
    readonly _supportsAvalanche = true;
    readonly _supportsOptimism = true;
    readonly _supportsBSC = true;
    readonly _supportsPolygon = true;
    readonly _supportsGnosis = true;
    readonly _supportsArbitrum = true;
    readonly _supportsArbitrumNova = true;
    readonly _supportsBase = true;
    readonly _supportsEthSwitchChain = false;

    #ethSigner: SignerAdapter | undefined;

    async ethInitializeWallet(masterKey: Isolation.Core.BIP32.Node): Promise<void> {
      const nodeAdapter = await Isolation.Adapters.BIP32.create(masterKey);

      this.#ethSigner = new SignerAdapter(nodeAdapter);
    }

    ethWipe() {
      this.#ethSigner = undefined;
    }

    async ethGetAddress(msg: core.ETHGetAddress): Promise<core.Address | null> {
      if (msg.addressNList.length < 5) {
        throw new Error(`path not supported length: ${msg.addressNList.length}`);
      }

      return this.needsMnemonic(!!this.#ethSigner, () => {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        return this.#ethSigner!.getAddress(msg.addressNList);
      });
    }

    async ethSignTx(msg: core.ETHSignTx): Promise<core.ETHSignedTx | null> {
      console.log("🟩 [Native] ethSignTx START", {
        msgKeys: Object.keys(msg),
        timestamp: new Date().toISOString()
      });

      // Log input transaction details
      console.log("🟩 [Native] INPUT TRANSACTION:", {
        to: msg.to,
        value: msg.value,
        data: msg.data ? `${msg.data.slice(0, 20)}...` : null,
        nonce: msg.nonce,
        gasLimit: msg.gasLimit,
        maxFeePerGas: msg.maxFeePerGas,
        maxPriorityFeePerGas: msg.maxPriorityFeePerGas,
        gasPrice: msg.gasPrice,
        chainId: msg.chainId,
        addressNList: msg.addressNList
      });

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

        console.log("🟩 [Native] BASE TRANSACTION OBJECT:", {
          to: utx.to,
          from: utx.from,
          value: utx.value,
          data: utx.data ? `${utx.data.slice(0, 20)}...` : null,
          nonce: utx.nonce,
          gasLimit: utx.gasLimit,
          chainId: utx.chainId
        });

        const transactionToSign = msg.maxFeePerGas
          ? {
              ...utx,
              maxFeePerGas: msg.maxFeePerGas,
              maxPriorityFeePerGas: msg.maxPriorityFeePerGas,
              type: core.ETHTransactionType.ETH_TX_TYPE_EIP_1559,
            }
          : {
              ...utx,
              gasPrice: msg.gasPrice,
              type: core.ETHTransactionType.ETH_TX_TYPE_LEGACY,
            };

        console.log("🟩 [Native] TRANSACTION TO SIGN:", {
          to: transactionToSign.to,
          from: transactionToSign.from,
          value: transactionToSign.value,
          data: transactionToSign.data ? `${transactionToSign.data.slice(0, 20)}...` : null,
          nonce: transactionToSign.nonce,
          gasLimit: transactionToSign.gasLimit,
          chainId: transactionToSign.chainId,
          maxFeePerGas: (transactionToSign as any).maxFeePerGas,
          maxPriorityFeePerGas: (transactionToSign as any).maxPriorityFeePerGas,
          gasPrice: (transactionToSign as any).gasPrice,
          type: transactionToSign.type
        });

        console.log("🟩 [Native] CALLING ethSigner.signTransaction...");
        const result: string = msg.maxFeePerGas
          ? // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            await this.#ethSigner!.signTransaction(transactionToSign, msg.addressNList)
          : // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            await this.#ethSigner!.signTransaction(transactionToSign, msg.addressNList);

        console.log("🟩 [Native] SIGNING RESULT:", {
          serialized: `${result.slice(0, 50)}...${result.slice(-20)}`,
          serializedLength: result.length
        });

        const decoded = parseTransaction(result);
        
        console.log("🟩 [Native] DECODED TRANSACTION:", {
          v: decoded.v,
          r: decoded.r,
          s: decoded.s,
          to: decoded.to,
          value: decoded.value?.toString(),
          data: decoded.data ? `${decoded.data.slice(0, 20)}...` : null,
          nonce: decoded.nonce,
          gasLimit: decoded.gasLimit?.toString(),
          maxFeePerGas: decoded.maxFeePerGas?.toString(),
          maxPriorityFeePerGas: decoded.maxPriorityFeePerGas?.toString(),
          gasPrice: decoded.gasPrice?.toString(),
          chainId: decoded.chainId,
          type: decoded.type
        });

        const finalResult = {
          v: core.mustBeDefined(decoded.v),
          r: core.mustBeDefined(decoded.r),
          s: core.mustBeDefined(decoded.s),
          serialized: result,
        };

        console.log("🟩 [Native] ethSignTx FINAL RESULT:", {
          v: finalResult.v,
          r: finalResult.r,
          s: finalResult.s,
          serializedLength: finalResult.serialized.length,
          timestamp: new Date().toISOString()
        });

        return finalResult;
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

    async ethSignTypedData(msg: core.ETHSignTypedData): Promise<core.ETHSignedTypedData | null> {
      return this.needsMnemonic(!!this.#ethSigner, async () => {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        return await this.#ethSigner!.signTypedData(msg.typedData, msg.addressNList);
      });
    }

    async ethVerifyMessage({ address, message, signature }: core.ETHVerifyMessage): Promise<boolean> {
      if (!signature.startsWith("0x")) signature = `0x${signature}`;
      const digest = keccak256(core.buildMessage(message));
      return recoverAddress(digest, signature) === address;
    }
  };
}
