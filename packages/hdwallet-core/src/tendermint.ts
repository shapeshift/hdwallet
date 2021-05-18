import { addressNListToBIP32, slip44ByCoin } from "./utils";
import { BIP32Path, PathDescription } from "./wallet";

export interface TendermintGetAddress {
  address_prefix?: string;
  address?: string;
  addressNList: BIP32Path;
  showDisplay?: boolean;
  testnet?: boolean;
}

export namespace Tendermint {
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

export interface TendermintTx {
  msg: Tendermint.Msg[];
  fee: Tendermint.StdFee;
  signatures: null | Tendermint.StdSignature[];
  memo: string;
}

export interface TendermintSignTx {
  account_number: string;
  addressNList: BIP32Path;
  chain_id: string;
  chain_name: string;
  decimals: string;
  denom: string;
  fee?: number;
  message_type_prefix: string;
  sequence: string;
  testnet?: boolean;
  tx: Tendermint.StdTx;
}

export type TendermintSignedTx = TendermintTx;

export interface TendermintGetAccountPaths {
  accountIdx: number;
}

export interface TendermintAccountPath {
  addressNList: BIP32Path;
}

export interface TendermintWalletInfo {
  _supportsTendermintInfo: boolean;

  /**
   * Returns a list of bip32 paths for a given account index in preferred order
   * from most to least preferred.
   */
  tendermintGetAccountPaths(msg: TendermintGetAccountPaths, coin: string): Array<TendermintAccountPath>;

  /**
   * Returns the "next" account path, if any.
   */
  tendermintNextAccountPath(msg: TendermintAccountPath, coin: string): TendermintAccountPath | undefined;
}

export interface TendermintWallet extends TendermintWalletInfo {
  _supportsTendermint: boolean;

  tendermintGetAddress(msg: TendermintGetAddress): Promise<string>;
  tendermintSignTx(msg: TendermintSignTx): Promise<TendermintSignedTx>;
}

export function tendermintDescribePath(path: BIP32Path, coin: string): PathDescription {
  let pathStr = addressNListToBIP32(path);
  let unknown: PathDescription = {
    verbose: pathStr,
    coin: coin,
    isKnown: false,
  };

  if (path.length != 5) {
    return unknown;
  }

  if (path[0] != 0x80000000 + 44) {
    return unknown;
  }

  if (path[1] != 0x80000000 + slip44ByCoin(coin)) {
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
    verbose: `${coin} Account #${index}`,
    accountIdx: index,
    wholeAccount: true,
    coin: coin,
    isKnown: true,
    isPrefork: false,
  };
}
