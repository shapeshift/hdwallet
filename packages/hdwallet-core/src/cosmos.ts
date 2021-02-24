import { addressNListToBIP32, slip44ByCoin } from "./utils";
import { BIP32Path, PathDescription } from "./wallet";

export interface CosmosGetAddress {
  addressNList: BIP32Path;
  showDisplay?: boolean;
}

export namespace Cosmos {
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

export interface CosmosTx {
  msg: Cosmos.Msg[];
  fee: Cosmos.StdFee;
  signatures: null | Cosmos.StdSignature[];
  memo: string;
}

export interface CosmosSignTx {
  addressNList: BIP32Path;
  tx: Cosmos.StdTx;
  chain_id: string;
  account_number: string;
  sequence: string;
  fee?: number;
}

export type CosmosSignedTx = CosmosTx;

export interface CosmosGetAccountPaths {
  accountIdx: number;
}

export interface CosmosAccountPath {
  addressNList: BIP32Path;
}

export interface CosmosWalletInfo {
  _supportsCosmosInfo: boolean;

  /**
   * Returns a list of bip32 paths for a given account index in preferred order
   * from most to least preferred.
   */
  cosmosGetAccountPaths(msg: CosmosGetAccountPaths): Array<CosmosAccountPath>;

  /**
   * Returns the "next" account path, if any.
   */
  cosmosNextAccountPath(msg: CosmosAccountPath): CosmosAccountPath | undefined;
}

export interface CosmosWallet extends CosmosWalletInfo {
  _supportsCosmos: boolean;

  cosmosGetAddress(msg: CosmosGetAddress): Promise<string>;
  cosmosSignTx(msg: CosmosSignTx): Promise<CosmosSignedTx>;
}

export function cosmosDescribePath(path: BIP32Path): PathDescription {
  let pathStr = addressNListToBIP32(path);
  let unknown: PathDescription = {
    verbose: pathStr,
    coin: "Atom",
    isKnown: false,
  };

  if (path.length != 5) {
    return unknown;
  }

  if (path[0] != 0x80000000 + 44) {
    return unknown;
  }

  if (path[1] != 0x80000000 + slip44ByCoin("Atom")) {
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
    verbose: `Cosmos Account #${index}`,
    accountIdx: index,
    wholeAccount: true,
    coin: "Atom",
    isKnown: true,
    isPrefork: false,
  };
}
