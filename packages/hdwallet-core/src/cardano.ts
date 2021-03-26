import { addressNListToBIP32, slip44ByCoin } from "./utils";
import { BIP32Path, PathDescription } from "./wallet";

export interface CardanoGetAddress {
  addressNList: BIP32Path;
  showDisplay?: boolean;
}

export namespace Cardano {
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

export interface CardanoTx {
  msg: Cardano.Msg[];
  fee: Cardano.StdFee;
  signatures: null | Cardano.StdSignature[];
  memo: string;
}

export interface CardanoSignTx {
  addressNList: BIP32Path;
  tx: Cardano.StdTx;
  chain_id: string;
  account_number: string;
  sequence: string;
  fee?: number;
}

export type CardanoSignedTx = CardanoTx;

export interface CardanoGetAccountPaths {
  accountIdx: number;
}

export interface CardanoAccountPath {
  addressNList: BIP32Path;
}

export interface CardanoWalletInfo {
  _supportsCardanoInfo: boolean;

  /**
   * Returns a list of bip32 paths for a given account index in preferred order
   * from most to least preferred.
   */
  cardanoGetAccountPaths(msg: CardanoGetAccountPaths): Array<CardanoAccountPath>;

  /**
   * Returns the "next" account path, if any.
   */
  cardanoNextAccountPath(msg: CardanoAccountPath): CardanoAccountPath | undefined;
}

export interface CardanoWallet extends CardanoWalletInfo {
  _supportsCardano: boolean;

  cardanoGetAddress(msg: CardanoGetAddress): Promise<string>;
  cardanoSignTx(msg: CardanoSignTx): Promise<CardanoSignedTx>;
}

//TODO
// Cardano m / 1852' / 1815' / 0' / 0 / 0
export function cardanoDescribePath(path: BIP32Path): PathDescription {
  let pathStr = addressNListToBIP32(path);
  let unknown: PathDescription = {
    verbose: pathStr,
    coin: "Ada",
    isKnown: false,
  };

  if (path.length != 5) {
    return unknown;
  }

  //Note: cardano does not follow bip44!
  //https://cips.cardano.org/cips/cip1852/
  if (path[0] != 0x80000000 + 1852) {
    return unknown;
  }

  if (path[1] != 0x80000000 + slip44ByCoin("Ada")) {
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
    verbose: `Cardano Account #${index}`,
    accountIdx: index,
    wholeAccount: true,
    coin: "Ada",
    isKnown: true,
    isPrefork: false,
  };
}
