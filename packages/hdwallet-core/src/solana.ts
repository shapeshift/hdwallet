import {
  AddressLookupTableAccount,
  ComputeBudgetProgram,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";

import { addressNListToBIP32, ed25519Path, slip44ByCoin } from "./utils";
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

export interface SolanaAddressLookupTableAccountInfo {
  key: string;
  data: Buffer;
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
  addressLookupTableAccountInfos?: SolanaAddressLookupTableAccountInfo[];
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

  if (path.length != 4) return unknown;
  if (path[0] != 0x80000000 + 44) return unknown;
  if (path[1] != 0x80000000 + slip44ByCoin("Solana")) return unknown;
  if ((path[2] & 0x80000000) >>> 0 !== 0x80000000) return unknown;
  if (path[3] !== 0x80000000 + 0) return unknown;

  const index = path[2] & 0x7fffffff;
  return {
    verbose: `Solana Account #${index}`,
    accountIdx: index,
    wholeAccount: true,
    coin: "Solana",
    isKnown: true,
  };
}

// The standard BIP44 derivation path for Solana is: m/44'/501'/<account>'/0'
// https://github.com/solana-labs/solana/blob/master/clap-v3-utils/src/keygen/derivation_path.rs#L7
export function solanaGetAccountPaths(msg: SolanaGetAccountPaths): Array<SolanaAccountPath> {
  const slip44 = slip44ByCoin("Solana");
  return [{ addressNList: [0x80000000 + 44, 0x80000000 + slip44, 0x80000000 + msg.accountIdx, 0x80000000 + 0] }];
}

// Solana uses the Ed25519 elliptic curve for cryptographic operations, which requires all levels of the derivation path to be hardened.
export function solanaAddressNListToBIP32(addressNList: BIP32Path): string {
  return addressNListToBIP32(ed25519Path(addressNList));
}

function toTransactionInstructions(instructions: SolanaTxInstruction[]): TransactionInstruction[] {
  return instructions.map(
    (instruction) =>
      new TransactionInstruction({
        keys: instruction.keys.map((key) => Object.assign(key, { pubkey: new PublicKey(key.pubkey) })),
        programId: new PublicKey(instruction.programId),
        data: instruction.data,
      })
  );
}

export function solanaBuildTransaction(msg: SolanaSignTx, address: string): VersionedTransaction {
  const instructions = toTransactionInstructions(msg.instructions ?? []);

  const value = Number(msg.value);
  if (!isNaN(value) && value > 0 && msg.to) {
    instructions.push(
      SystemProgram.transfer({
        fromPubkey: new PublicKey(address),
        toPubkey: new PublicKey(msg.to),
        lamports: value,
      })
    );
  }

  if (msg.computeUnitLimit !== undefined) {
    instructions.push(ComputeBudgetProgram.setComputeUnitLimit({ units: msg.computeUnitLimit }));
  }

  if (msg.computeUnitPrice !== undefined) {
    instructions.push(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: msg.computeUnitPrice }));
  }

  const addressLookupTableAccounts = msg.addressLookupTableAccountInfos?.map((accountInfo) => {
    return new AddressLookupTableAccount({
      key: new PublicKey(accountInfo.key),
      state: AddressLookupTableAccount.deserialize(new Uint8Array(accountInfo.data)),
    });
  });

  const message = new TransactionMessage({
    payerKey: new PublicKey(address),
    instructions,
    recentBlockhash: msg.blockHash,
  }).compileToV0Message(addressLookupTableAccounts);

  return new VersionedTransaction(message);
}
