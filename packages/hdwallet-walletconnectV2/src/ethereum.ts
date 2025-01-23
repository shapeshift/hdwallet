import type {
  BIP32Path,
  ETHSignedMessage,
  ETHSignedTx,
  ETHSignTx,
  ETHSignTypedData,
  ETHTxHash,
  ETHVerifyMessage,
  PathDescription,
} from "@shapeshiftoss/hdwallet-core";
import { addressNListToBIP32, slip44ByCoin } from "@shapeshiftoss/hdwallet-core";
import EthereumProvider from "@walletconnect/ethereum-provider";
import { isHexString } from "ethers/lib/utils";

const getUnsignedTxFromMessage = (msg: ETHSignTx & { from: string }) => {
  const utxBase = {
    from: msg.from,
    to: msg.to,
    value: msg.value,
    data: msg.data,
    // WARNING: Do *NOT* uncomment me. Diff. wallets may not handle me properly and this *WILL* make Tx broadcast fail for some.
    // Assume the user is on the correct chain given the assertSwitchChain() call in chain-adapters
    // If they weren't, and the chain switch failed, they can always switch manually in their wallet.
    // chainId: msg.chainId,
    nonce: msg.nonce,
    gasLimit: msg.gasLimit,
  };

  return msg.maxFeePerGas
    ? {
        ...utxBase,
        maxFeePerGas: msg.maxFeePerGas,
        maxPriorityFeePerGas: msg.maxPriorityFeePerGas,
        // See https://github.com/ethereum/EIPs/blob/master/EIPS/eip-1559.md#specification
        // Tagged as EIP-1559 Tx (2) explicitly to ensure compatibility accross wallets
        type: "0x2",
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
  args: { data: string; fromAddress: string },
  provider: EthereumProvider
): Promise<ETHSignedMessage | null> {
  if (!isHexString(args.data)) throw new Error("data is not an hex string");

  const signedMsg: string = await provider.request({
    method: "personal_sign",
    params: [args.data, args.fromAddress],
  });

  return {
    address: args.fromAddress,
    signature: signedMsg,
  };
}

export async function ethSignTypedData(
  args: { msg: ETHSignTypedData; fromAddress: string },
  provider: EthereumProvider
): Promise<ETHSignedMessage | null> {
  const { msg, fromAddress } = args;
  try {
    const signedMsg = await provider.request({
      method: "eth_signTypedData_v4",
      params: [fromAddress, JSON.stringify(msg.typedData)],
    });

    return {
      address: fromAddress,
      signature: signedMsg,
    } as ETHSignedMessage;
  } catch (error) {
    console.error(error);
    return null;
  }
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
