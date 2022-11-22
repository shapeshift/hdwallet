import * as core from "@keepkey/hdwallet-core";
import * as ethers from "ethers";

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

export async function ethSignTx(
  args: core.ETHSignTx & { from: string },
  provider: any
): Promise<core.ETHSignedTx | null> {
  return await provider.wc.signTransaction(args);
}

export async function ethSendTx(
  args: core.ETHSignTx & { from: string },
  provider: any
): Promise<core.ETHTxHash | null> {
  const txHash: string = await provider.wc.sendTransaction(args);
  return txHash
    ? {
        hash: txHash,
      }
    : null;
}

export async function ethSignMessage(
  args: { data: string | ethers.Bytes; fromAddress: string },
  provider: any
): Promise<core.ETHSignedMessage | null> {
  const buffer = ethers.utils.isBytes(args.data)
    ? Buffer.from(ethers.utils.arrayify(args.data))
    : Buffer.from(args.data);
  return await provider.wc.signMessage([buffer.toString("hex"), args.fromAddress]);
}

export async function ethGetAddress(provider: any): Promise<string | null> {
  try {
    if (!(provider && provider.request && provider.connected)) {
      throw new Error("No WalletConnect provider available.");
    }
    const ethAccounts = await provider.request({
      method: "eth_accounts",
    });
    return ethAccounts[0];
  } catch (error) {
    console.error(error);
    return null;
  }
}
