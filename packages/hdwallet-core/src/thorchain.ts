import { addressNListToBIP32, slip44ByCoin } from "./utils";
import { BIP32Path, HDWallet, HDWalletInfo, PathDescription } from "./wallet";

export interface ThorchainGetAddress {
  addressNList: BIP32Path;
  showDisplay?: boolean;
  testnet?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Thorchain {
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
    fee: StdFee;
    memo: string;
    msg: Msg[];
    signatures: null | StdSignature[];
  }
}

export interface ThorchainTx {
  msg: Thorchain.Msg[];
  fee: Thorchain.StdFee;
  signatures: null | Thorchain.StdSignature[];
  memo: string;
}

export interface ThorchainSignTx {
  addressNList: BIP32Path;
  tx: Thorchain.StdTx;
  sequence: string;
  account_number: string;
  chain_id: string;
  fee?: number;
  testnet?: boolean;
}

export type ThorchainSignedTx = ThorchainTx;

export interface ThorchainGetAccountPaths {
  accountIdx: number;
}

export interface ThorchainAccountPath {
  addressNList: BIP32Path;
}

export interface ThorchainWalletInfo extends HDWalletInfo {
  readonly _supportsThorchainInfo: boolean;

  /**
   * Returns a list of bip32 paths for a given account index in preferred order
   * from most to least preferred.
   */
  thorchainGetAccountPaths(msg: ThorchainGetAccountPaths): Array<ThorchainAccountPath>;

  /**
   * Returns the "next" account path, if any.
   */
  thorchainNextAccountPath(msg: ThorchainAccountPath): ThorchainAccountPath | undefined;
}

export interface ThorchainWallet extends ThorchainWalletInfo, HDWallet {
  readonly _supportsThorchain: boolean;

  thorchainGetAddress(msg: ThorchainGetAddress): Promise<string | null>;
  thorchainSignTx(msg: ThorchainSignTx): Promise<ThorchainSignedTx | null>;
}

export function thorchainDescribePath(path: BIP32Path): PathDescription {
  const pathStr = addressNListToBIP32(path);
  const unknown: PathDescription = {
    verbose: pathStr,
    coin: "Rune",
    isKnown: false,
  };

  if (path.length != 5) {
    return unknown;
  }

  if (path[0] != 0x80000000 + 44) {
    return unknown;
  }

  if (path[1] != 0x80000000 + slip44ByCoin("Rune")) {
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
    verbose: `Thorchain Account #${index}`,
    accountIdx: index,
    wholeAccount: true,
    coin: "Thorchain",
    isKnown: true,
    isPrefork: false,
  };
}
