import * as core from "@shapeshiftoss/hdwallet-core";
import { ETHSignedMessage } from "@shapeshiftoss/hdwallet-core";
import { isHexString } from "ethers/lib/utils";

export function describeETHPath(path: core.BIP32Path): core.PathDescription {
  return core.describeETHPath(path);
}

export function ethGetAccountPaths(msg: core.ETHGetAccountPath): Array<core.ETHAccountPath> {
  const slip44 = core.slip44ByCoin(msg.coin);
  if (slip44 === undefined) return [];
  return [
    {
      addressNList: [0x80000000 + 44, 0x80000000 + slip44, 0x80000000 + msg.accountIdx, 0, 0],
      hardenedPath: [0x80000000 + 44, 0x80000000 + slip44, 0x80000000 + msg.accountIdx],
      relPath: [0, 0],
      description: "Coinbase",
    },
  ];
}

export async function ethGetAddress(ethereum: any): Promise<string | null> {
  if (!(ethereum && ethereum.request)) {
    return null;
  }
  try {
    const ethAccounts = await ethereum.request({
      method: "eth_accounts",
    });
    return ethAccounts[0];
  } catch (error) {
    console.error(error);
    return null;
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function ethSignTx(msg: core.ETHSignTx, ethereum: any, from: string): Promise<core.ETHSignedTx | null> {
  console.error("Method ethSignTx unsupported for Coinbase wallet");
  return null;
}

export async function ethSendTx(msg: core.ETHSignTx, ethereum: any, from: string): Promise<core.ETHTxHash | null> {
  try {
    const utxBase = {
      from: from,
      to: msg.to,
      value: msg.value,
      data: msg.data,
      chainId: msg.chainId,
      nonce: msg.nonce,
      gas: msg.gasLimit,
    };

    const utx = msg.maxFeePerGas
      ? {
          ...utxBase,
          maxFeePerGas: msg.maxFeePerGas,
          maxPriorityFeePerGas: msg.maxPriorityFeePerGas,
        }
      : { ...utxBase, gasPrice: msg.gasPrice };

    const signedTx = await ethereum.request({
      method: "eth_sendTransaction",
      params: [utx],
    });

    return {
      hash: signedTx,
    } as core.ETHTxHash;
  } catch (error) {
    console.error(error);
    return null;
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function ethVerifyMessage(msg: core.ETHVerifyMessage, ethereum: any): Promise<boolean | null> {
  console.error("Method ethVerifyMessage unsupported for Coinbase wallet!");
  return null;
}

export async function ethSignTypedData(
  msg: core.ETHSignTypedData,
  ethereum: any,
  address: string
): Promise<core.ETHSignedMessage | null> {
  try {
    const signedMsg = await ethereum.request({
      method: "eth_signTypedData_v4",
      params: [address, JSON.stringify(msg.typedData)],
      from: address,
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

export async function ethSignMessage(
  msg: core.ETHSignMessage,
  ethereum: any,
  address: string
): Promise<core.ETHSignedMessage | null> {
  try {
    if (!isHexString(msg.message)) throw new Error("data is not an hex string");
    const signedMsg = await ethereum.request({
      method: "personal_sign",
      params: [msg, address],
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
