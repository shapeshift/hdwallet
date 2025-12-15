import { addressNListToBIP32, slip44ByCoin } from "./utils";
import { BIP32Path, HDWallet, HDWalletInfo, PathDescription } from "./wallet";

export interface SuiGetAddress {
  addressNList: BIP32Path;
  showDisplay?: boolean;
}

export interface SuiSignTx {
  addressNList: BIP32Path;
  /** Intent message bytes to sign (intent scope + version + app id + tx bytes) */
  intentMessageBytes: Uint8Array;
  /** Optional transaction JSON for wallets that need it (e.g., Phantom) */
  transactionJson?: string;
}

export interface SuiSignedTx {
  signature: string;
  publicKey: string;
}

export interface SuiGetAccountPaths {
  accountIdx: number;
}

export interface SuiAccountPath {
  addressNList: BIP32Path;
}

export interface SuiWalletInfo extends HDWalletInfo {
  readonly _supportsSuiInfo: boolean;

  /**
   * Returns a list of bip32 paths for a given account index in preferred order
   * from most to least preferred.
   */
  suiGetAccountPaths(msg: SuiGetAccountPaths): Array<SuiAccountPath>;

  /**
   * Returns the "next" account path, if any.
   */
  suiNextAccountPath(msg: SuiAccountPath): SuiAccountPath | undefined;
}

export interface SuiWallet extends SuiWalletInfo, HDWallet {
  readonly _supportsSui: boolean;

  suiGetAddress(msg: SuiGetAddress): Promise<string | null>;
  suiGetAddresses?(msgs: SuiGetAddress[]): Promise<string[]>;
  suiSignTx(msg: SuiSignTx): Promise<SuiSignedTx | null>;
}

export function suiDescribePath(path: BIP32Path): PathDescription {
  const pathStr = addressNListToBIP32(path);
  const unknown: PathDescription = {
    verbose: pathStr,
    coin: "Sui",
    isKnown: false,
  };

  if (path.length != 5) return unknown;
  if (path[0] != 0x80000000 + 44) return unknown;
  if (path[1] != 0x80000000 + slip44ByCoin("Sui")) return unknown;
  if ((path[2] & 0x80000000) >>> 0 !== 0x80000000) return unknown;
  if ((path[3] & 0x80000000) >>> 0 !== 0x80000000) return unknown;
  if ((path[4] & 0x80000000) >>> 0 !== 0x80000000) return unknown;

  const index = path[2] & 0x7fffffff;
  return {
    verbose: `Sui Account #${index}`,
    accountIdx: index,
    wholeAccount: true,
    coin: "Sui",
    isKnown: true,
  };
}

// The standard derivation path for Sui is: m/44'/784'/<account>'/0'/0'
// Sui uses SLIP-0010 which requires all derivation to be hardened for Ed25519
// https://docs.sui.io/concepts/cryptography/transaction-auth/keys-addresses
export function suiGetAccountPaths(msg: SuiGetAccountPaths): Array<SuiAccountPath> {
  const slip44 = slip44ByCoin("Sui");
  return [
    {
      addressNList: [0x80000000 + 44, 0x80000000 + slip44, 0x80000000 + msg.accountIdx, 0x80000000 + 0, 0x80000000 + 0],
    },
  ];
}
