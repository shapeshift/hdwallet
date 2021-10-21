import * as core from "@shapeshiftoss/hdwallet-core";
import { ETHSignedMessage } from "@shapeshiftoss/hdwallet-core";

export function describeETHPath(path: core.BIP32Path): core.PathDescription {
  return undefined;
}

export async function ethVerifyMessage(msg: core.ETHVerifyMessage, ethereum: any): Promise<boolean> {
  console.error("Method ethVerifyMessage unsupported for MetaMask wallet!");
  return undefined;
}

export function ethGetAccountPaths(msg: core.ETHGetAccountPath): Array<core.ETHAccountPath> {
  const slip44 = core.slip44ByCoin(msg.coin);
  if (slip44 === undefined) return [];
  return [
    {
      addressNList: [0x80000000 + 44, 0x80000000 + slip44, 0x80000000 + msg.accountIdx, 0, 0],
      hardenedPath: [0x80000000 + 44, 0x80000000 + slip44, 0x80000000 + msg.accountIdx],
      relPath: [0, 0],
      description: "MetaMask",
    },
  ];
}

export async function ethSignTx(msg: core.ETHSignTx, ethereum: any, from: string): Promise<core.ETHSignedTx> {
  console.error("Method ethSignTx unsupported for MetaMask wallet!");
  return undefined;
}

export async function ethSendTx(msg: core.ETHSendTx, ethereum: any, from: string): Promise<core.ETHSignedTx> {
  try {
    const signedTx = await ethereum.request({
      method: "eth_sendTransaction",
      params: [
        {
          from: from,
          to: msg.to,
          gas: msg.gasLimit,
          gasPrice: msg.gasPrice,
          value: msg.value,
          data: msg.data,
          nonce: msg.nonce,
        },
      ],
    });

    return {
      v: 0,
      r: "",
      s: "",
      serialized: signedTx.result,
    } as core.ETHSignedTx;
  } catch (error) {
    console.error(error);
  }
}

export async function ethSignMessage(
  msg: core.ETHSignMessage,
  ethereum: any,
  address: string
): Promise<core.ETHSignedMessage> {
  try {
    const signedMsg = await ethereum.request({
      method: "eth_sign",
      params: [address, msg.message],
    });
    return {
      address: address,
      signature: signedMsg.result,
    } as ETHSignedMessage;
  } catch (error) {
    console.error(error);
  }
}

export async function ethGetAddress(ethereum: any): Promise<string> {
  try {
    const ethAccounts = await ethereum.request({
      method: "eth_accounts",
    });
    return ethAccounts[0];
  } catch (error) {
    console.error(error);
  }
}
