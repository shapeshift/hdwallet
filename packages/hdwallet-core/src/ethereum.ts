import { addressNListToBIP32, slip44ByCoin } from "./utils";
import { BIP32Path, ExchangeType, HDWallet, HDWalletInfo, PathDescription } from "./wallet";

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
  exchangeType?: ExchangeType;
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
  message: string;
}

export interface ETHSignedMessage {
  address: string;
  signature: string;
}

export interface ETHVerifyMessage {
  address: string;
  message: string;
  signature: string;
}

export interface ETHWalletInfo extends HDWalletInfo {
  readonly _supportsETHInfo: boolean;

  /**
   * Does the device support the Ethereum network with the given chain_id?
   */
  ethSupportsNetwork(chain_id: number): Promise<boolean>;

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

  ethGetAddress(msg: ETHGetAddress): Promise<string | null>;
  ethSignTx(msg: ETHSignTx): Promise<ETHSignedTx | null>;
  ethSendTx?(msg: ETHSignTx): Promise<ETHTxHash | null>;
  ethSignMessage(msg: ETHSignMessage): Promise<ETHSignedMessage | null>;
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
