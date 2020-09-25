import { addressNListToBIP32, slip44ByCoin } from "./utils";
import { BIP32Path, PathDescription } from "./wallet";

export interface BinanceGetAddress {
  addressNList: BIP32Path;
  showDisplay?: boolean;
  /** Optional. Required for showDisplay == true. */
  address?: string;
}

namespace Binance {
  namespace sdk {
    export type Coins = Coin[];

    export interface Coin {
      denom: string;
      amount: string;
    }
  }

  export interface StdFee {
    amount: sdk.Coins;
    gas: string;
  }

  export interface StdSignature {
    pub_key: string;
    signature: string;
  }
}

export interface BinanceTx {
  account_number: string;
  chain_id: string;
  data: string;
  memo: string;
  //TODO type the tx msg
  msgs: any;
  signatures?: {
    pub_key: string;
    signature: string;
  };
  txid?: string;
  serialized?: string;
}

export interface BinanceSignTx {
  addressNList: BIP32Path;
  tx: BinanceTx;
  chain_id: string;
  account_number: string;
  sequence: string;
}

export type BinanceSignedTx = BinanceTx;

export interface BinanceGetAccountPaths {
  accountIdx: number;
}

export interface BinanceAccountPath {
  addressNList: BIP32Path;
}

export interface BinanceWalletInfo {
  _supportsBinanceInfo: boolean;

  /**
   * Returns a list of bip32 paths for a given account index in preferred order
   * from most to least preferred.
   */
  binanceGetAccountPaths(msg: BinanceGetAccountPaths): Array<BinanceAccountPath>;

  /**
   * Returns the "next" account path, if any.
   */
  binanceNextAccountPath(msg: BinanceAccountPath): BinanceAccountPath | undefined;
}

export interface BinanceWallet extends BinanceWalletInfo {
  _supportsBinance: boolean;

  binanceGetAddress(msg: BinanceGetAddress): Promise<string>;

  binanceSignTx(msg: BinanceSignTx): Promise<BinanceSignedTx>;
}

export function binanceDescribePath(path: BIP32Path): PathDescription {
  let pathStr = addressNListToBIP32(path);
  let unknown: PathDescription = {
    verbose: pathStr,
    coin: "Binance",
    isKnown: false,
  };

  if (path.length != 5) {
    return unknown;
  }

  if (path[0] != 0x80000000 + 44) {
    return unknown;
  }

  if (path[1] != 0x80000000 + slip44ByCoin("Binance")) {
    return unknown;
  }

  if ((path[2] & 0x80000000) >>> 0 !== 0x80000000) {
    return unknown;
  }

  if (path[3] !== 0 || path[4] !== 0) {
    return unknown;
  }

  let index = path[2] & 0x7fffffff;
  return {
    verbose: `Binance Account #${index}`,
    accountIdx: index,
    wholeAccount: true,
    coin: "Binance",
    isKnown: true,
    isPrefork: false,
  };
}
