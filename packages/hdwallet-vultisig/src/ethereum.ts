import * as core from "@shapeshiftoss/hdwallet-core";
import { ETHSignedMessage } from "@shapeshiftoss/hdwallet-core";
import { AddEthereumChainParameter } from "@shapeshiftoss/hdwallet-core";
import { ethErrors, serializeError } from "eth-rpc-errors";
import { isHexString } from "ethers/lib/utils";

import { VultisigEvmProvider } from "./types";

export function ethGetAccountPaths(msg: core.ETHGetAccountPath): Array<core.ETHAccountPath> {
  const slip44 = core.slip44ByCoin(msg.coin);
  if (slip44 === undefined) return [];
  return [
    {
      addressNList: [0x80000000 + 44, 0x80000000 + slip44, 0x80000000 + msg.accountIdx, 0, 0],
      hardenedPath: [0x80000000 + 44, 0x80000000 + slip44, 0x80000000 + msg.accountIdx],
      relPath: [0, 0],
      description: "Vultisig",
    },
  ];
}

export async function ethSendTx(
  msg: core.ETHSignTx,
  vultisig: VultisigEvmProvider,
  from: string
): Promise<core.ETHTxHash | null> {
  try {
    const utxBase = {
      from: from,
      to: msg.to,
      value: msg.value,
      nonce: msg.nonce,
      chainId: msg.chainId,
      data: msg.data,
      gas: msg.gasLimit,
    };

    const utx = msg.maxFeePerGas
      ? {
          ...utxBase,
          maxFeePerGas: msg.maxFeePerGas,
          maxPriorityFeePerGas: msg.maxPriorityFeePerGas,
        }
      : { ...utxBase, gasPrice: msg.gasPrice };

    const signedTx = await vultisig.request?.({
      method: "eth_sendTransaction",
      params: [utx],
    });

    return { hash: signedTx } as core.ETHTxHash;
  } catch (error) {
    console.error(error);
    return null;
  }
}

export async function ethSignMessage(
  msg: core.ETHSignMessage,
  vultisig: VultisigEvmProvider,
  address: string
): Promise<core.ETHSignedMessage | null> {
  try {
    if (!isHexString(msg.message)) throw new Error("data is not an hex string");
    const signedMsg = await vultisig.request?.({
      method: "personal_sign",
      params: [msg.message, address],
    });

    return {
      address: address,
      signature: signedMsg,
    } as ETHSignedMessage;
  } catch (error) {
    console.error(error);
    return null;
  }
}

export async function ethSignTypedData(
  msg: core.ETHSignTypedData,
  vultisig: VultisigEvmProvider,
  address: string
): Promise<core.ETHSignedMessage | null> {
  try {
    const signedMsg = await vultisig.request?.({
      method: "eth_signTypedData_v4",
      params: [address, JSON.stringify(msg.typedData)],
    });

    return {
      address: address,
      signature: signedMsg,
    } as ETHSignedMessage;
  } catch (error) {
    console.error(error);
    return null;
  }
}

export async function ethGetAddress(vultisig: VultisigEvmProvider): Promise<core.Address | null> {
  if (!(vultisig && vultisig.request)) {
    return null;
  }
  try {
    const ethAccounts = await vultisig.request({
      method: "eth_accounts",
    });
    return ethAccounts[0];
  } catch (error) {
    console.error(error);
    return null;
  }
}
export async function ethGetChainId(evmProvider: VultisigEvmProvider): Promise<number | null> {
  try {
    // chainId as hex string
    const chainId: string = (await evmProvider?.request?.({ method: "eth_chainId" })) || "";
    return parseInt(chainId, 16);
  } catch (e) {
    console.error(e);
    return null;
  }
}

export async function ethAddChain(evmProvider: VultisigEvmProvider, params: AddEthereumChainParameter): Promise<void> {
  // at this point, we know that we're in the context of a valid Coinbase provider
  await evmProvider?.request?.({ method: "wallet_addEthereumChain", params: [params] });
}

export async function ethSwitchChain(
  evmProvider: VultisigEvmProvider,
  params: AddEthereumChainParameter
): Promise<void> {
  try {
    // at this point, we know that we're in the context of a valid Coinbase provider
    await evmProvider?.request?.({ method: "wallet_switchEthereumChain", params: [{ chainId: params.chainId }] });
  } catch (e: any) {
    const error = serializeError(e);
    if (error.code === -32603) {
      try {
        await ethAddChain(evmProvider, params);
        return;
      } catch (addChainE: any) {
        const addChainError = serializeError(addChainE);

        if (addChainError.code === 4001) {
          throw ethErrors.provider.userRejectedRequest();
        }

        throw (addChainError.data as any).originalError as {
          code: number;
          message: string;
          stack: string;
        };
      }
    }

    if (error.code === 4001) {
      throw ethErrors.provider.userRejectedRequest();
    }

    throw (error.data as any).originalError as {
      code: number;
      message: string;
      stack: string;
    };
  }
}
