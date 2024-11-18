import { AddressLookupTableAccount } from "@solana/web3.js";

import { addressNListToBIP32, slip44ByCoin } from "./utils";
import { BIP32Path, HDWallet, HDWalletInfo, PathDescription } from "./wallet";

export interface SolanaGetAddress {
  addressNList: BIP32Path;
  showDisplay?: boolean;
}

export interface SolanaAccount {
  pubkey: string;
  isSigner: boolean;
  isWritable: boolean;
}

export interface SolanaTxInstruction {
  keys: SolanaAccount[];
  programId: string;
  data?: Buffer;
}

export interface SolanaSignTx {
  addressNList: BIP32Path;
  /** to is the destination pubkey for the transfer */
  to: string;
  /** value is the amount to transfer in micro lamports*/
  value: string;
  /** blockHash is used for expiry determination */
  blockHash: string;
  /** computeUnitLimit is the maximum number of compute units allowed to be consumed by the transaction */
  computeUnitLimit?: number;
  /** computeUnitPrice is the additional fee payed to boost transaction prioritization in micro lamports (priority fee) */
  computeUnitPrice?: number;
  /** instructions are additional instructions to construct the transaction with (exclude transfer, setComputeUnitLimit and setComputeUnitPrice) */
  instructions?: SolanaTxInstruction[];
  /** Address look up table accounts */
  addressLookupTableAccounts?: AddressLookupTableAccount[];
}

export interface SolanaSignedTx {
  serialized: string;
  signatures: string[];
}

export interface SolanaTxSignature {
  signature: string;
}

export interface SolanaGetAccountPaths {
  accountIdx: number;
}

export interface SolanaAccountPath {
  addressNList: BIP32Path;
}

export interface SolanaWalletInfo extends HDWalletInfo {
  readonly _supportsSolanaInfo: boolean;

  /**
   * Returns a list of bip32 paths for a given account index in preferred order
   * from most to least preferred.
   */
  solanaGetAccountPaths(msg: SolanaGetAccountPaths): Array<SolanaAccountPath>;

  /**
   * Returns the "next" account path, if any.
   */
  solanaNextAccountPath(msg: SolanaAccountPath): SolanaAccountPath | undefined;
}

export interface SolanaWallet extends SolanaWalletInfo, HDWallet {
  readonly _supportsSolana: boolean;

  solanaGetAddress(msg: SolanaGetAddress): Promise<string | null>;
  solanaSignTx(msg: SolanaSignTx): Promise<SolanaSignedTx | null>;
  solanaSendTx?(msg: SolanaSignTx): Promise<SolanaTxSignature | null>;
}

export function solanaDescribePath(path: BIP32Path): PathDescription {
  const pathStr = addressNListToBIP32(path);
  const unknown: PathDescription = {
    verbose: pathStr,
    coin: "Solana",
    isKnown: false,
  };

  if (path.length != 5) return unknown;
  if (path[0] != 0x80000000 + 44) return unknown;
  if (path[1] != 0x80000000 + slip44ByCoin("Solana")) return unknown;
  if ((path[2] & 0x80000000) >>> 0 !== 0x80000000) return unknown;
  if (path[3] !== 0 || path[4] !== 0) return unknown;

  const index = path[2] & 0x7fffffff;
  return {
    verbose: `Solana Account #${index}`,
    accountIdx: index,
    wholeAccount: true,
    coin: "Solana",
    isKnown: true,
  };
}

export function solanaGetAccountPaths(msg: SolanaGetAccountPaths): Array<SolanaAccountPath> {
  const slip44 = slip44ByCoin("Solana");
  return [{ addressNList: [0x80000000 + 44, 0x80000000 + slip44, 0x80000000 + msg.accountIdx, 0, 0] }];
}
