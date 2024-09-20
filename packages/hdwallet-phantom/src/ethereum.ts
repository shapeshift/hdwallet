import * as core from "@shapeshiftoss/hdwallet-core";
import { ETHSignedMessage } from "@shapeshiftoss/hdwallet-core";
import { isHexString } from "ethers/lib/utils";

import { PhantomEvmProvider } from "./types";

export function ethGetAccountPaths(msg: core.ETHGetAccountPath): Array<core.ETHAccountPath> {
  const slip44 = core.slip44ByCoin(msg.coin);
  if (slip44 === undefined) return [];
  return [
    {
      addressNList: [0x80000000 + 44, 0x80000000 + slip44, 0x80000000 + msg.accountIdx, 0, 0],
      hardenedPath: [0x80000000 + 44, 0x80000000 + slip44, 0x80000000 + msg.accountIdx],
      relPath: [0, 0],
      description: "Phantom",
    },
  ];
}

export async function ethSendTx(
  msg: core.ETHSignTx,
  phantom: PhantomEvmProvider,
  from: string
): Promise<core.ETHTxHash | null> {
  try {
    const utxBase = {
      from: from,
      to: msg.to,
      value: msg.value,
      chainId: msg.chainId,
      data: msg.data,
      gasLimit: msg.gasLimit,
    };

    const utx = msg.maxFeePerGas
      ? {
          ...utxBase,
          maxFeePerGas: msg.maxFeePerGas,
          maxPriorityFeePerGas: msg.maxPriorityFeePerGas,
        }
      : { ...utxBase, gasPrice: msg.gasPrice };

    const signedTx = await phantom.request?.({
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
  phantom: PhantomEvmProvider,
  address: string
): Promise<core.ETHSignedMessage | null> {
  try {
    if (!isHexString(msg.message)) throw new Error("data is not an hex string");
    const signedMsg = await phantom.request?.({
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
  phantom: PhantomEvmProvider,
  address: string
): Promise<core.ETHSignedMessage | null> {
  try {
    const signedMsg = await phantom.request?.({
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

export async function ethGetAddress(phantom: PhantomEvmProvider): Promise<string | null> {
  if (!(phantom && phantom.request)) {
    return null;
  }
  try {
    const ethAccounts = await phantom.request({
      method: "eth_accounts",
    });
    return ethAccounts[0];
  } catch (error) {
    console.error(error);
    return null;
  }
}
