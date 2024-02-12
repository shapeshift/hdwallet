import { addressNListToBIP32, slip44ByCoin } from "./utils";
import { BIP32Path, HDWallet, HDWalletInfo, PathDescription } from "./wallet";

export interface MayachainGetAddress {
  addressNList: BIP32Path;
  showDisplay?: boolean;
  testnet?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Mayachain {
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
    pub_key: crypto.PubKey;
    signature: string;
  }

  export interface StdTx {
    fee: StdFee;
    memo?: string;
    msg: Msg[];
    signatures: StdSignature[];
  }
}

export interface MayachainTx {
  msg: Mayachain.Msg[];
  fee: Mayachain.StdFee;
  signatures: Mayachain.StdSignature[];
  memo?: string;
}

export interface MayachainSignTx {
  addressNList: BIP32Path;
  tx: Mayachain.StdTx;
  sequence: string;
  account_number: string;
  chain_id: string;
  fee?: number;
  testnet?: boolean;
}

export interface MayachainSignedTx {
  serialized: string;
  body: string;
  authInfoBytes: string;
  signatures: string[];
}

export interface MayachainGetAccountPaths {
  accountIdx: number;
}

export interface MayachainAccountPath {
  addressNList: BIP32Path;
}

export interface MayachainWalletInfo extends HDWalletInfo {
  readonly _supportsMayachainInfo: boolean;

  /**
   * Returns a list of bip32 paths for a given account index in preferred order
   * from most to least preferred.
   */
  mayachainGetAccountPaths(msg: MayachainGetAccountPaths): Array<MayachainAccountPath>;

  /**
   * Returns the "next" account path, if any.
   */
  mayachainNextAccountPath(msg: MayachainAccountPath): MayachainAccountPath | undefined;
}

export interface MayachainWallet extends MayachainWalletInfo, HDWallet {
  readonly _supportsMayachain: boolean;

  mayachainGetAddress(msg: MayachainGetAddress): Promise<string | null>;
  mayachainSignTx(msg: MayachainSignTx): Promise<MayachainSignedTx | null>;
}

export function mayachainDescribePath(path: BIP32Path): PathDescription {
  const pathStr = addressNListToBIP32(path);
  const unknown: PathDescription = {
    verbose: pathStr,
    coin: "Cacao",
    isKnown: false,
  };

  if (path.length != 5) {
    return unknown;
  }

  if (path[0] != 0x80000000 + 44) {
    return unknown;
  }

  if (path[1] != 0x80000000 + slip44ByCoin("Cacao")) {
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
    verbose: `Mayachain Account #${index}`,
    accountIdx: index,
    wholeAccount: true,
    coin: "Mayachain",
    isKnown: true,
    isPrefork: false,
  };
}
