import { addressNListToBIP32, slip44ByCoin } from "./utils";
import { BIP32Path, HDWallet, HDWalletInfo, PathDescription } from "./wallet";

export interface NearGetAddress {
  addressNList: BIP32Path;
  showDisplay?: boolean;
}

export interface NearSignTx {
  addressNList: BIP32Path;
  /** Borsh-serialized transaction bytes to sign */
  txBytes: Uint8Array;
}

export interface NearSignedTx {
  signature: string;
  publicKey: string;
}

export interface NearGetAccountPaths {
  accountIdx: number;
}

export interface NearAccountPath {
  addressNList: BIP32Path;
}

export interface NearWalletInfo extends HDWalletInfo {
  readonly _supportsNearInfo: boolean;

  /**
   * Returns a list of bip32 paths for a given account index in preferred order
   * from most to least preferred.
   */
  nearGetAccountPaths(msg: NearGetAccountPaths): Array<NearAccountPath>;

  /**
   * Returns the "next" account path, if any.
   */
  nearNextAccountPath(msg: NearAccountPath): NearAccountPath | undefined;
}

export interface NearWallet extends NearWalletInfo, HDWallet {
  readonly _supportsNear: boolean;

  nearGetAddress(msg: NearGetAddress): Promise<string | null>;
  nearGetAddresses?(msgs: NearGetAddress[]): Promise<string[]>;
  nearSignTx(msg: NearSignTx): Promise<NearSignedTx | null>;
}

export function nearDescribePath(path: BIP32Path): PathDescription {
  const pathStr = addressNListToBIP32(path);
  const unknown: PathDescription = {
    verbose: pathStr,
    coin: "Near",
    isKnown: false,
  };

  if (path.length != 5) return unknown;
  if (path[0] != 0x80000000 + 44) return unknown;
  if (path[1] != 0x80000000 + slip44ByCoin("Near")) return unknown;
  if ((path[2] & 0x80000000) >>> 0 !== 0x80000000) return unknown;
  if ((path[3] & 0x80000000) >>> 0 !== 0x80000000) return unknown;
  if ((path[4] & 0x80000000) >>> 0 !== 0x80000000) return unknown;

  const index = path[2] & 0x7fffffff;
  return {
    verbose: `Near Account #${index}`,
    accountIdx: index,
    wholeAccount: true,
    coin: "Near",
    isKnown: true,
  };
}

// The standard derivation path for NEAR is: m/44'/397'/<account>'/0'/0'
// NEAR uses SLIP-0010 which requires all derivation to be hardened for Ed25519
// https://docs.near.org/integrations/implicit-accounts
export function nearGetAccountPaths(msg: NearGetAccountPaths): Array<NearAccountPath> {
  const slip44 = slip44ByCoin("Near");
  return [
    {
      addressNList: [0x80000000 + 44, 0x80000000 + slip44, 0x80000000 + msg.accountIdx, 0x80000000 + 0, 0x80000000 + 0],
    },
  ];
}
