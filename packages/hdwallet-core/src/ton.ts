import { addressNListToBIP32, slip44ByCoin } from "./utils";
import { BIP32Path, HDWallet, HDWalletInfo, PathDescription } from "./wallet";

export interface TonGetAddress {
  addressNList: BIP32Path;
  showDisplay?: boolean;
}

export interface TonRawMessage {
  targetAddress: string;
  sendAmount: string;
  payload: string;
  stateInit?: string;
}

export interface TonSignTx {
  addressNList: BIP32Path;
  /** Raw message bytes to sign (BOC serialized) - used for simple transfers */
  message?: Uint8Array;
  /** Raw messages from external protocols like Stonfi - used for complex swaps */
  rawMessages?: TonRawMessage[];
  /** Sequence number for the wallet */
  seqno?: number;
  /** Transaction expiration timestamp */
  expireAt?: number;
}

export interface TonSignedTx {
  signature: string;
  serialized: string;
}

export interface TonGetAccountPaths {
  accountIdx: number;
}

export interface TonAccountPath {
  addressNList: BIP32Path;
}

export interface TonWalletInfo extends HDWalletInfo {
  readonly _supportsTonInfo: boolean;

  /**
   * Returns a list of bip32 paths for a given account index in preferred order
   * from most to least preferred.
   */
  tonGetAccountPaths(msg: TonGetAccountPaths): Array<TonAccountPath>;

  /**
   * Returns the "next" account path, if any.
   */
  tonNextAccountPath(msg: TonAccountPath): TonAccountPath | undefined;
}

export interface TonWallet extends TonWalletInfo, HDWallet {
  readonly _supportsTon: boolean;

  tonGetAddress(msg: TonGetAddress): Promise<string | null>;
  tonSignTx(msg: TonSignTx): Promise<TonSignedTx | null>;
}

export function tonDescribePath(path: BIP32Path): PathDescription {
  const pathStr = addressNListToBIP32(path);
  const unknown: PathDescription = {
    verbose: pathStr,
    coin: "Ton",
    isKnown: false,
  };

  // TON uses a 3-level path like Stellar: m/44'/607'/<account>'
  const slip44 = slip44ByCoin("Ton");
  if (slip44 === undefined) return unknown;
  if (path.length != 3) return unknown;
  if (path[0] != 0x80000000 + 44) return unknown;
  if (path[1] != 0x80000000 + slip44) return unknown;
  if ((path[2] & 0x80000000) >>> 0 !== 0x80000000) return unknown;

  const index = path[2] & 0x7fffffff;
  return {
    verbose: `TON Account #${index}`,
    accountIdx: index,
    wholeAccount: true,
    coin: "Ton",
    isKnown: true,
  };
}

// TON uses a 3-level hardened derivation path: m/44'/607'/<account>'
// This follows the same pattern as Stellar (SEP-0005) since TON uses Ed25519
// https://github.com/satoshilabs/slips/blob/master/slip-0044.md (607 = TON)
export function tonGetAccountPaths(msg: TonGetAccountPaths): Array<TonAccountPath> {
  const slip44 = slip44ByCoin("Ton");
  if (slip44 === undefined) return [];
  return [
    {
      addressNList: [0x80000000 + 44, 0x80000000 + slip44, 0x80000000 + msg.accountIdx],
    },
  ];
}
