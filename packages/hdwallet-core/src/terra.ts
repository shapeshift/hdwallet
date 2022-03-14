import { addressNListToBIP32, slip44ByCoin } from "./utils";
import { BIP32Path, HDWallet, HDWalletInfo, PathDescription } from "./wallet";

export interface TerraGetAddress {
  addressNList: BIP32Path;
  showDisplay?: boolean;
  testnet?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Terra {
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

export interface TerraTx {
  msg: Terra.Msg[];
  fee: Terra.StdFee;
  signatures: null | Terra.StdSignature[];
  memo: string;
}

export interface TerraSignTx {
  addressNList: BIP32Path;
  tx: Terra.StdTx;
  chain_id: string;
  account_number: string;
  sequence: string;
  fee?: number;
  testnet?: boolean;
}

export type TerraSignedTx = TerraTx;

export interface TerraGetAccountPaths {
  accountIdx: number;
}

export interface TerraAccountPath {
  addressNList: BIP32Path;
}

export interface TerraWalletInfo extends HDWalletInfo {
  readonly _supportsTerraInfo: boolean;

  /**
   * Returns a list of bip32 paths for a given account index in preferred order
   * from most to least preferred.
   */
  terraGetAccountPaths(msg: TerraGetAccountPaths): Array<TerraAccountPath>;

  /**
   * Returns the "next" account path, if any.
   */
  terraNextAccountPath(msg: TerraAccountPath): TerraAccountPath | undefined;
}

export interface TerraWallet extends TerraWalletInfo, HDWallet {
  readonly _supportsTerra: boolean;

  terraGetAddress(msg: TerraGetAddress): Promise<string | null>;
  terraSignTx(msg: TerraSignTx): Promise<TerraSignedTx | null>;
}

export function terraDescribePath(path: BIP32Path): PathDescription {
  const pathStr = addressNListToBIP32(path);
  const unknown: PathDescription = {
    verbose: pathStr,
    coin: "Terra",
    isKnown: false,
  };

  if (path.length != 5) {
    return unknown;
  }

  if (path[0] != 0x80000000 + 44) {
    return unknown;
  }

  if (path[1] != 0x80000000 + slip44ByCoin("Terra")) {
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
    verbose: `Terra Account #${index}`,
    accountIdx: index,
    wholeAccount: true,
    coin: "Terra",
    isKnown: true,
    isPrefork: false,
  };
}
