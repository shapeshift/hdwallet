import { addressNListToBIP32, slip44ByCoin } from "./utils";
import { BIP32Path, HDWallet, HDWalletInfo, PathDescription } from "./wallet";

export interface OsmosisGetAddress {
  addressNList: BIP32Path;
  showDisplay?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Osmosis {
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

export interface OsmosisTx {
  msg: Osmosis.Msg[];
  fee: Osmosis.StdFee;
  signatures: null | Osmosis.StdSignature[];
  memo: string;
}

export interface OsmosisSignTx {
  addressNList: BIP32Path;
  tx: Osmosis.StdTx;
  chain_id: string;
  account_number: string;
  sequence: string;
  fee?: number;
}

export interface OsmosisSignedTx {
  serialized: string;
  body: string;
  authInfoBytes: string;
  signatures: string[];
}

export interface OsmosisGetAccountPaths {
  accountIdx: number;
}

export interface OsmosisAccountPath {
  addressNList: BIP32Path;
}

export interface OsmosisWalletInfo extends HDWalletInfo {
  readonly _supportsOsmosisInfo: boolean;

  /**
   * Returns a list of bip32 paths for a given account index in preferred order
   * from most to least preferred.
   */
  osmosisGetAccountPaths(msg: OsmosisGetAccountPaths): Array<OsmosisAccountPath>;

  /**
   * Returns the "next" account path, if any.
   */
  osmosisNextAccountPath(msg: OsmosisAccountPath): OsmosisAccountPath | undefined;
}

export interface OsmosisWallet extends OsmosisWalletInfo, HDWallet {
  readonly _supportsOsmosis: boolean;

  osmosisGetAddress(msg: OsmosisGetAddress): Promise<string | null>;
  osmosisSignTx(msg: OsmosisSignTx): Promise<OsmosisSignedTx | null>;
}

export function osmosisDescribePath(path: BIP32Path): PathDescription {
  const pathStr = addressNListToBIP32(path);
  const unknown: PathDescription = {
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

  if (path[1] != 0x80000000 + slip44ByCoin("Osmo")) {
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
    verbose: `Osmosis Account #${index}`,
    accountIdx: index,
    wholeAccount: true,
    coin: "Osmo",
    isKnown: true,
    isPrefork: false,
  };
}
