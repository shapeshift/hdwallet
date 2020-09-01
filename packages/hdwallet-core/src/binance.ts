import { BIP32Path } from "./wallet";

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
