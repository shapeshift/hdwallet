import { addressNListToBIP32, slip44ByCoin } from "./utils";
import { BIP32Path, HDWallet, HDWalletInfo, PathDescription } from "./wallet";

export interface KavaGetAddress {
  addressNList: BIP32Path;
  showDisplay?: boolean;
  testnet?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Kava {
  export interface Msg {
    type: string;
    value: any;
  }

  export type Coins = Coin[];

  export interface Coin {
    denom: string;
    amount: string;
  }

  export interface StdFee {
    amount: Coins;
    gas: string;
  }

  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace crypto {
    export interface PubKey {
      type: string;
      value: string;
    }
  }

  export interface StdSignature {
    pub_key?: crypto.PubKey;
    signature: string;
  }

  export interface StdTx {
    msg: Msg[];
    fee: StdFee;
    signatures: null | StdSignature[];
    memo: string;
  }
}

export interface KavaTx {
  msg: Kava.Msg[];
  fee: Kava.StdFee;
  signatures: null | Kava.StdSignature[];
  memo: string;
}

export interface KavaSignTx {
  addressNList: BIP32Path;
  tx: Kava.StdTx;
  chain_id: string;
  account_number: string;
  sequence: string;
  fee?: number;
  testnet?: boolean;
}

export type KavaSignedTx = KavaTx;

export interface KavaGetAccountPaths {
  accountIdx: number;
}

export interface KavaAccountPath {
  addressNList: BIP32Path;
}

export interface KavaWalletInfo extends HDWalletInfo {
  readonly _supportsKavaInfo: boolean;

  /**
   * Returns a list of bip32 paths for a given account index in preferred order
   * from most to least preferred.
   */
  kavaGetAccountPaths(msg: KavaGetAccountPaths): Array<KavaAccountPath>;

  /**
   * Returns the "next" account path, if any.
   */
  kavaNextAccountPath(msg: KavaAccountPath): KavaAccountPath | undefined;
}

export interface KavaWallet extends KavaWalletInfo, HDWallet {
  readonly _supportsKava: boolean;

  kavaGetAddress(msg: KavaGetAddress): Promise<string | null>;
  kavaSignTx(msg: KavaSignTx): Promise<KavaSignedTx | null>;
}

export function kavaDescribePath(path: BIP32Path): PathDescription {
  const pathStr = addressNListToBIP32(path);
  const unknown: PathDescription = {
    verbose: pathStr,
    coin: "Kava",
    isKnown: false,
  };

  if (path.length != 5) {
    return unknown;
  }

  if (path[0] != 0x80000000 + 44) {
    return unknown;
  }

  if (path[1] != 0x80000000 + slip44ByCoin("Kava")) {
    return unknown;
  }

  if ((path[2] & 0x80000000) >>> 0 !== 0x80000000) {
    return unknown;
  }

  if (path[3] !== 0 || path[4] !== 0) {
    return unknown;
  }

  const index = path[2] & 0x7fffffff;
  return {
    verbose: `Kava Account #${index}`,
    accountIdx: index,
    wholeAccount: true,
    coin: "Kava",
    isKnown: true,
    isPrefork: false,
  };
}
