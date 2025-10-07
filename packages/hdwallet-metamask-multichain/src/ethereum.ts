import * as core from "@shapeshiftoss/hdwallet-core";
import { ETHSignedMessage } from "@shapeshiftoss/hdwallet-core";
import { Address } from "@shapeshiftoss/hdwallet-core";
import { isHexString } from "ethers/lib/utils";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function ethVerifyMessage(msg: core.ETHVerifyMessage, ethereum: any): Promise<boolean | null> {
  console.error("Method ethVerifyMessage unsupported for MetaMask wallet!");
  return null;
}

export function ethGetAccountPaths(msg: core.ETHGetAccountPath): Array<core.ETHAccountPath> {
  const slip44 = core.slip44ByCoin(msg.coin);
  if (slip44 === undefined) return [];
  return [
    {
      addressNList: [0x80000000 + 44, 0x80000000 + slip44, 0x80000000 + msg.accountIdx, 0, 0],
      hardenedPath: [0x80000000 + 44, 0x80000000 + slip44, 0x80000000 + msg.accountIdx],
      relPath: [0, 0],
      description: "MetaMask(Shapeshift Multichain)",
    },
  ];
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function ethSignTx(msg: core.ETHSignTx, ethereum: any, from: string): Promise<core.ETHSignedTx | null> {
  console.log("🟨 [MetaMask] ethSignTx called - UNSUPPORTED", {
    msgKeys: Object.keys(msg),
    from,
    timestamp: new Date().toISOString()
  });
  console.error("Method ethSignTx unsupported for MetaMask wallet!");
  return null;
}

export async function ethSendTx(msg: core.ETHSignTx, ethereum: any, from: string): Promise<core.ETHTxHash | null> {
  console.log("🟨 [MetaMask] ethSendTx START", {
    msgKeys: Object.keys(msg),
    from,
    timestamp: new Date().toISOString()
  });

  // Log input transaction details
  console.log("🟨 [MetaMask] INPUT TRANSACTION:", {
    to: msg.to,
    value: msg.value,
    data: msg.data ? `${msg.data.slice(0, 20)}...` : null,
    nonce: msg.nonce,
    gasLimit: msg.gasLimit,
    maxFeePerGas: msg.maxFeePerGas,
    maxPriorityFeePerGas: msg.maxPriorityFeePerGas,
    gasPrice: msg.gasPrice,
    chainId: msg.chainId,
    from
  });

  try {
    const utxBase = {
      from: from,
      to: msg.to,
      value: msg.value,
      data: msg.data,
      chainId: msg.chainId,
      nonce: msg.nonce,
      // MetaMask, like other Web3 libraries, derives its transaction schema from Ethereum's official JSON-RPC API specification
      // (https://github.com/ethereum/execution-apis/blob/d63d2a02bcd2a8cef54ae2fc5bbff8b4fac944eb/src/schemas/transaction.json).
      // That schema defines the use of the label `gas` to set the transaction's gas limit and not `gasLimit` as used in other
      // libraries and as stated in the official yellow paper (https://ethereum.github.io/yellowpaper/paper.pdf).
      gas: msg.gasLimit,
    };

    console.log("🟨 [MetaMask] BASE TRANSACTION OBJECT:", {
      from: utxBase.from,
      to: utxBase.to,
      value: utxBase.value,
      data: utxBase.data ? `${utxBase.data.slice(0, 20)}...` : null,
      chainId: utxBase.chainId,
      nonce: utxBase.nonce,
      gas: utxBase.gas
    });

    const utx = msg.maxFeePerGas
      ? {
          ...utxBase,
          maxFeePerGas: msg.maxFeePerGas,
          maxPriorityFeePerGas: msg.maxPriorityFeePerGas,
        }
      : { ...utxBase, gasPrice: msg.gasPrice };

    console.log("🟨 [MetaMask] FINAL TRANSACTION TO SEND:", {
      from: utx.from,
      to: utx.to,
      value: utx.value,
      data: utx.data ? `${utx.data.slice(0, 20)}...` : null,
      chainId: utx.chainId,
      nonce: utx.nonce,
      gas: utx.gas,
      maxFeePerGas: (utx as any).maxFeePerGas,
      maxPriorityFeePerGas: (utx as any).maxPriorityFeePerGas,
      gasPrice: (utx as any).gasPrice
    });

    console.log("🟨 [MetaMask] CALLING ethereum.request(eth_sendTransaction)...");
    const signedTx = await ethereum.request({
      method: "eth_sendTransaction",
      params: [utx],
    });

    console.log("🟨 [MetaMask] ethSendTx RESULT:", {
      hash: signedTx,
      timestamp: new Date().toISOString()
    });

    return {
      hash: signedTx,
    } as core.ETHTxHash;
  } catch (error) {
    console.error("🟨 [MetaMask] ethSendTx ERROR:", error);
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

export async function ethGetAddress(ethereum: any): Promise<Address | null> {
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
