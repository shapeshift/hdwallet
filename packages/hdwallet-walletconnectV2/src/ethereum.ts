import type {
  BIP32Path,
  ETHSignedMessage,
  ETHSignedTx,
  ETHSignTx,
  ETHTxHash,
  ETHVerifyMessage,
  PathDescription,
} from "@shapeshiftoss/hdwallet-core";
import { addressNListToBIP32, slip44ByCoin } from "@shapeshiftoss/hdwallet-core";
import EthereumProvider from "@walletconnect/ethereum-provider";
import * as ethers from "ethers";

const getUnsignedTxFromMessage = (msg: ETHSignTx & { from: string }) => {
  const utxBase = {
    from: msg.from,
    to: msg.to,
    value: msg.value,
    data: msg.data,
    chainId: msg.chainId,
    nonce: msg.nonce,
    gasLimit: msg.gasLimit,
  };

  return msg.maxFeePerGas
    ? {
        ...utxBase,
        maxFeePerGas: msg.maxFeePerGas,
        maxPriorityFeePerGas: msg.maxPriorityFeePerGas,
      }
    : { ...utxBase, gasPrice: msg.gasPrice };
};

export function describeETHPath(path: BIP32Path): PathDescription {
  const pathStr = addressNListToBIP32(path);
  const unknown: PathDescription = {
    verbose: pathStr,
    coin: "Ethereum",
    isKnown: false,
  };

  if (path.length !== 5) return unknown;

  if (path[0] !== 0x80000000 + 44) return unknown;

  if (path[1] !== 0x80000000 + slip44ByCoin("Ethereum")) return unknown;

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

export async function ethSignTx(
  args: ETHSignTx & { from: string },
  provider: EthereumProvider
): Promise<ETHSignedTx | null> {
  const utx = getUnsignedTxFromMessage(args);
  return await provider.request({ method: "eth_signTransaction", params: [utx] });
}

export async function ethSendTx(
  msg: ETHSignTx & { from: string },
  provider: EthereumProvider
): Promise<ETHTxHash | null> {
  const utx = getUnsignedTxFromMessage(msg);
  const txHash: string = await provider.request({ method: "eth_sendTransaction", params: [utx] });
  return txHash
    ? {
        hash: txHash,
      }
    : null;
}

export async function ethSignMessage(
  args: { data: string | ethers.Bytes; fromAddress: string },
  provider: EthereumProvider
): Promise<ETHSignedMessage | null> {
  const buffer = ethers.utils.isBytes(args.data)
    ? Buffer.from(ethers.utils.arrayify(args.data))
    : Buffer.from(args.data);

  return await provider.request({
    method: "eth_sign",
    params: [args.fromAddress, buffer],
  });
}

export async function ethGetAddress(provider: EthereumProvider): Promise<string | null> {
  try {
    if (!(provider && provider.connected)) {
      throw new Error("No WalletConnectV2 provider available.");
    }
    const ethAccounts: string[] = await provider.request({
      method: "eth_accounts",
    });
    return ethAccounts[0];
  } catch (error) {
    console.error(error);
    return null;
  }
}

export async function ethVerifyMessage(provider: EthereumProvider, args: ETHVerifyMessage): Promise<boolean> {
  return await provider.request({ method: "ethVerifyMessage", params: [args.message, args.signature] });
}
