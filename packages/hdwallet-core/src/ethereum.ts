import { Bytes } from "@ethersproject/bytes";
import { TypedData } from "eip-712";

import { addressNListToBIP32, slip44ByCoin } from "./utils";
import { BIP32Path, HDWallet, HDWalletInfo, PathDescription } from "./wallet";

// https://github.com/MetaMask/eth-rpc-errors/blob/f917c2cfee9e6117a88be4178f2a877aff3acabe/src/classes.ts#L3-L7
export interface SerializedEthereumRpcError {
  code: number;
  message: string;
  stack?: string;
}

export enum ETHTransactionType {
  ETH_TX_TYPE_LEGACY = 0,
  ETH_TX_TYPE_EIP_2930 = 1,
  ETH_TX_TYPE_EIP_1559 = 2,
}

export interface ETHGetAccountPath {
  coin: string;
  accountIdx: number;
}

/**
 * Concat accountPath with relPath for the absolute path to the Ethereum address.
 */
export interface ETHAccountPath {
  addressNList: BIP32Path;
  hardenedPath: BIP32Path;
  relPath: BIP32Path;
  description: string;
}

export interface ETHAccountSuffix {
  addressNList: BIP32Path;
}

export interface ETHGetAddress {
  addressNList: BIP32Path;
  showDisplay?: boolean;
}

export type ETHSignTx = {
  /** bip32 path to sign the transaction from */
  addressNList: BIP32Path;
  /** big-endian hex, prefixed with '0x' */
  nonce: string;
  /** big-endian hex, prefixed with '0x' */
  gasLimit: string;
  /** address, with '0x' prefix */
  to: string;
  /** bip32 path for destination (device must `ethSupportsSecureTransfer()`) */
  toAddressNList?: BIP32Path;
  /** big-endian hex, prefixed with '0x' */
  value: string;
  /** prefixed with '0x' */
  data: string;
  /** mainnet: 1, ropsten: 3, kovan: 42 */
  chainId: number;
  /**
   * Device must `ethSupportsNativeShapeShift()`
   */
} & (
  | {
      /** big-endian hex, prefixed with '0x' */
      gasPrice: string;
      maxFeePerGas?: never;
      maxPriorityFeePerGas?: never;
    }
  | {
      gasPrice?: never;
      /** EIP-1559 - The maximum total fee per gas the sender is willing to pay. <=256 bit unsigned big endian (in wei) */
      maxFeePerGas?: string;
      /** EIP-1559 - Maximum fee per gas the sender is willing to pay to miners. <=256 bit unsigned big endian (in wei) */
      maxPriorityFeePerGas?: string;
    }
);

export interface ETHTxHash {
  hash: string;
}

export interface ETHSignedTx {
  /** uint32 */
  v: number;
  /** big-endian hex, prefixed with '0x' */
  r: string;
  /** big-endian hex, prefixed with '0x' */
  s: string;
  /** big-endian hex, prefixed with '0x' */
  serialized: string;
}

export interface ETHSignMessage {
  addressNList: BIP32Path;
  message: string | Bytes;
}

export interface ETHSignedMessage {
  address: string;
  signature: string;
}

export interface ETHVerifyMessage {
  address: string;
  message: string | Bytes;
  signature: string;
}

export type ETHSignTypedData = TypedData & { addressNList: BIP32Path };

export type ETHSignedTypedData = {
  signature: string;
  address: string;
  domainSeparatorHash: string;
  messageHash?: string;
};

// https://docs.metamask.io/guide/rpc-api.html#wallet-addethereumchain
export interface AddEthereumChainParameter {
  chainId: string; // A 0x-prefixed hexadecimal string
  chainName: string;
  nativeCurrency: {
    name: string;
    symbol: string; // 2-6 characters long
    decimals: 18;
  };
  rpcUrls: string[];
  blockExplorerUrls?: string[];
  iconUrls?: string[]; // Currently ignored.
}

export interface ETHWalletInfo extends HDWalletInfo {
  readonly _supportsETHInfo: boolean;

  /**
   * Does the device support the Ethereum network with the given chain_id?
   */
  ethSupportsNetwork(chain_id: number): Promise<boolean>;

  /**
   * Get the current chainId from ethereum's JSON RPC
   * https://eips.ethereum.org/EIPS/eip-695
   */
  ethGetChainId?(): Promise<number | null>;

  /**
   * Switch the wallet's active Ethereum chain
   * https://eips.ethereum.org/EIPS/eip-3326
   */
  ethSwitchChain?(chain_id: number): Promise<void>;

  /**
   * Add an Ethereum chain to user's wallet
   * https://eips.ethereum.org/EIPS/eip-3085
   * */
  ethAddChain?(params: AddEthereumChainParameter): Promise<void>;

  /**
   * Does the device support internal transfers without the user needing to
   * confirm the destination address?
   */
  ethSupportsSecureTransfer(): Promise<boolean>;

  /**
   * Does the device support `/sendamountProto2` style ShapeShift trades?
   */
  ethSupportsNativeShapeShift(): boolean;

  /**
   *
   * Does the device support transactions with EIP-1559 fee parameters?
   */
  ethSupportsEIP1559(): Promise<boolean>;

  /**
   * Returns a list of bip32 paths for a given account index in preferred order
   * from most to least preferred.
   *
   * Note that this is the location of the ETH address in the tree, not the
   * location of its corresponding xpub.
   */
  ethGetAccountPaths(msg: ETHGetAccountPath): Array<ETHAccountPath>;

  /**
   * Returns the "next" ETH account, if any.
   */
  ethNextAccountPath(msg: ETHAccountPath): ETHAccountPath | undefined;
}

export interface ETHWallet extends ETHWalletInfo, HDWallet {
  readonly _supportsETH: boolean;
  readonly _supportsEthSwitchChain: boolean;
  readonly _supportsAvalanche: boolean;

  ethGetAddress(msg: ETHGetAddress): Promise<string | null>;
  ethSignTx(msg: ETHSignTx): Promise<ETHSignedTx | null>;
  ethSendTx?(msg: ETHSignTx): Promise<ETHTxHash | null>;
  ethSignMessage(msg: ETHSignMessage): Promise<ETHSignedMessage | null>;
  ethSignTypedData?(msg: ETHSignTypedData): Promise<ETHSignedTypedData | null>;
  ethVerifyMessage(msg: ETHVerifyMessage): Promise<boolean | null>;
}

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
    isPrefork: false,
  };
}
