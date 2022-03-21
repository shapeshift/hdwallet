import * as core from "@shapeshiftoss/hdwallet-core";
import { ETHSignedMessage } from "@shapeshiftoss/hdwallet-core";

export function describeETHPath(path: core.BIP32Path): core.PathDescription {
  const pathStr = core.addressNListToBIP32(path);
  const unknown: core.PathDescription = {
    verbose: pathStr,
    coin: "Ethereum",
    isKnown: false,
  };

  if (path.length !== 5) return unknown;

  if (path[0] !== 0x80000000 + 44) return unknown;

  if (path[1] !== 0x80000000 + core.slip44ByCoin("Ethereum")) return unknown;

  if ((path[2] & 0x80000000) >>> 0 !== 0x80000000) return unknown;

  if (path[3] !== 0) return unknown;

  if (path[4] !== 0) return unknown;

  const index = path[2] & 0x7fffffff;
  return {
    verbose: `Ethereum Account #${index}`,
    accountIdx: index,
    wholeAccount: true,
    coin: "Ethereum",
    isKnown: true,
  };
}

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
      description: "MetaMask",
    },
  ];
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function ethSignTx(msg: core.ETHSignTx, ethereum: any, from: string): Promise<core.ETHSignedTx | null> {
  console.error("Method ethSignTx unsupported for MetaMask wallet!");
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
      // MetaMask, like other Web3 libraries, derives its transaction schema from Ethereum's official JSON-RPC API specification
      // (https://github.com/ethereum/execution-apis/blob/d63d2a02bcd2a8cef54ae2fc5bbff8b4fac944eb/src/schemas/transaction.json).
      // That schema defines the use of the label `gas` to set the transaction's gas limit and not `gasLimit` as used in other
      // libraries and as stated in the official yellow paper (https://ethereum.github.io/yellowpaper/paper.pdf).
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

export async function ethSignMessage(
  msg: core.ETHSignMessage,
  ethereum: any,
  address: string
): Promise<core.ETHSignedMessage | null> {
  try {
    const signedMsg = await ethereum.request({
      method: "personal_sign",
      params: [Buffer.from(msg.message).toString("hex"), address],
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
