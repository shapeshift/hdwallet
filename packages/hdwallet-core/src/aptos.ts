import { addressNListToBIP32, slip44ByCoin } from "./utils";
import { BIP32Path, HDWallet, HDWalletInfo, PathDescription } from "./wallet";

export interface AptosGetAddress {
  addressNList: BIP32Path;
  showDisplay?: boolean;
}

export interface AptosSignTx {
  addressNList: BIP32Path;
  /** Transaction bytes to sign */
  transactionBytes: Uint8Array;
}

export interface AptosSignedTx {
  signature: string;
  publicKey: string;
}

export interface AptosGetAccountPaths {
  accountIdx: number;
}

export interface AptosAccountPath {
  addressNList: BIP32Path;
}

export interface AptosWalletInfo extends HDWalletInfo {
  readonly _supportsAptosInfo: boolean;

  /**
   * Returns a list of bip32 paths for a given account index in preferred order
   * from most to least preferred.
   */
  aptosGetAccountPaths(msg: AptosGetAccountPaths): Array<AptosAccountPath>;

  /**
   * Returns "next" account path, if any.
   */
  aptosNextAccountPath(msg: AptosAccountPath): AptosAccountPath | undefined;
}

export interface AptosWallet extends AptosWalletInfo, HDWallet {
  readonly _supportsAptos: boolean;

  aptosGetAddress(msg: AptosGetAddress): Promise<string | null>;
  aptosGetAddresses?(msgs: AptosGetAddress[]): Promise<string[]>;
  aptosSignTx(msg: AptosSignTx): Promise<AptosSignedTx | null>;
}

export function aptosDescribePath(path: BIP32Path): PathDescription {
  const pathStr = addressNListToBIP32(path);
  const unknown: PathDescription = {
    verbose: pathStr,
    coin: "Aptos",
    isKnown: false,
  };

  if (path.length != 5) return unknown;
  if (path[0] != 0x80000000 + 44) return unknown;
  if (path[1] != 0x80000000 + slip44ByCoin("Aptos")) return unknown;
  if ((path[2] & 0x80000000) >>> 0 !== 0x80000000) return unknown;
  if ((path[3] & 0x80000000) >>> 0 !== 0x80000000) return unknown;
  if ((path[4] & 0x80000000) >>> 0 !== 0x80000000) return unknown;

  const index = path[2] & 0x7fffffff;
  return {
    verbose: `Aptos Account #${index}`,
    accountIdx: index,
    wholeAccount: true,
    coin: "Aptos",
    isKnown: true,
  };
}

// The standard derivation path for Aptos is: m/44'/637'/<account>'/0'/0'
// Aptos uses SLIP-0010 which requires all derivation to be hardened for Ed25519
// https://aptos.dev/concepts/accounts#accounts-and-signatures
export function aptosGetAccountPaths(msg: AptosGetAccountPaths): Array<AptosAccountPath> {
  const slip44 = slip44ByCoin("Aptos");
  return [
    {
      addressNList: [0x80000000 + 44, 0x80000000 + slip44, 0x80000000 + msg.accountIdx, 0x80000000 + 0, 0x80000000 + 0],
    },
  ];
}
