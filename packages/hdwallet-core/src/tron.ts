import { addressNListToBIP32, slip44ByCoin } from "./utils";
import { BIP32Path, HDWallet, HDWalletInfo, PathDescription } from "./wallet";

export interface TronGetAddress {
  addressNList: BIP32Path;
  showDisplay?: boolean;
  pubKey?: string;
}

export interface TronSignTx {
  addressNList: BIP32Path;
  /** Raw transaction data in hex format */
  rawDataHex: string;
}

export interface TronSignedTx {
  serialized: string;
  signature: string;
}

export interface TronTxSignature {
  signature: string;
}

export interface TronGetAccountPaths {
  accountIdx: number;
}

export interface TronAccountPath {
  addressNList: BIP32Path;
}

export interface TronWalletInfo extends HDWalletInfo {
  readonly _supportsTronInfo: boolean;

  /**
   * Returns a list of bip32 paths for a given account index in preferred order
   * from most to least preferred.
   */
  tronGetAccountPaths(msg: TronGetAccountPaths): Array<TronAccountPath>;

  /**
   * Returns the "next" account path, if any.
   */
  tronNextAccountPath(msg: TronAccountPath): TronAccountPath | undefined;
}

export interface TronWallet extends TronWalletInfo, HDWallet {
  readonly _supportsTron: boolean;

  tronGetAddress(msg: TronGetAddress): Promise<string | null>;
  tronGetAddresses?(msgs: TronGetAddress[]): Promise<string[]>;
  tronSignTx(msg: TronSignTx): Promise<TronSignedTx | null>;
  tronSendTx?(msg: TronSignTx): Promise<TronTxSignature | null>;
}

export function tronDescribePath(path: BIP32Path): PathDescription {
  const pathStr = addressNListToBIP32(path);
  const unknown: PathDescription = {
    verbose: pathStr,
    coin: "Tron",
    isKnown: false,
  };

  if (path.length != 5) return unknown;
  if (path[0] != 0x80000000 + 44) return unknown;
  if (path[1] != 0x80000000 + slip44ByCoin("Tron")) return unknown;
  if ((path[2] & 0x80000000) >>> 0 !== 0x80000000) return unknown;
  if (path[3] !== 0) return unknown;
  if (path[4] !== 0) return unknown;

  const index = path[2] & 0x7fffffff;
  return {
    verbose: `Tron Account #${index}`,
    accountIdx: index,
    wholeAccount: true,
    coin: "Tron",
    isKnown: true,
  };
}

// The standard BIP44 derivation path for Tron is: m/44'/195'/<account>'/0/0
// https://github.com/tronprotocol/tips/issues/102
export function tronGetAccountPaths(msg: TronGetAccountPaths): Array<TronAccountPath> {
  const slip44 = slip44ByCoin("Tron");
  return [{ addressNList: [0x80000000 + 44, 0x80000000 + slip44, 0x80000000 + msg.accountIdx, 0, 0] }];
}
