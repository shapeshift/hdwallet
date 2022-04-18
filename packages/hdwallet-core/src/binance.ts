import { addressNListToBIP32, slip44ByCoin } from "./utils";
import { BIP32Path, HDWallet, HDWalletInfo, PathDescription } from "./wallet";

export interface BinanceGetAddress {
  addressNList: BIP32Path;
  showDisplay?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-namespace
namespace Binance {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace sdk {
    export type Coins = Coin[];

    export interface Coin {
      denom: string;
      amount: number;
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

  export interface MsgSend {
    inputs: Array<{
      address: string;
      coins: sdk.Coins;
    }>;
    outputs: Array<{
      address: string;
      coins: sdk.Coins;
    }>;
  }

  export type Msg = MsgSend;
}

export interface BinanceTx {
  account_number: string;
  chain_id: string;
  data: string | null;
  memo: string;
  msgs: [Binance.Msg];
  // These are actually numbers, but they're encoded as strings by the chain.
  sequence: string;
  source?: string;
}

export type BinancePartialTx = Partial<BinanceTx> & Pick<BinanceTx, "msgs">;

export interface BinanceSignTx {
  addressNList: BIP32Path;
  testnet?: boolean;
  tx: BinancePartialTx;
}

export interface BinanceSignedTx extends BinanceTx {
  signatures: {
    pub_key: string;
    signature: string;
  };
  txid: string;
  serialized: string;
}

export interface BinanceGetAccountPaths {
  accountIdx: number;
}

export interface BinanceAccountPath {
  addressNList: BIP32Path;
}

export interface BinanceWalletInfo extends HDWalletInfo {
  readonly _supportsBinanceInfo: boolean;

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

export interface BinanceWallet extends BinanceWalletInfo, HDWallet {
  readonly _supportsBinance: boolean;

  binanceGetAddress(msg: BinanceGetAddress): Promise<string | null>;

  binanceSignTx(msg: BinanceSignTx): Promise<BinanceSignedTx | null>;
}

export function binanceDescribePath(path: BIP32Path): PathDescription {
  const pathStr = addressNListToBIP32(path);
  const unknown: PathDescription = {
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

  const index = path[2] & 0x7fffffff;
  return {
    verbose: `Binance Account #${index}`,
    accountIdx: index,
    wholeAccount: true,
    coin: "Binance",
    isKnown: true,
    isPrefork: false,
  };
}
