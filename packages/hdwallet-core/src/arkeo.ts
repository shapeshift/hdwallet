import { addressNListToBIP32, slip44ByCoin } from "./utils";
import { BIP32Path, HDWallet, HDWalletInfo, PathDescription } from "./wallet";

export interface ArkeoGetAddress {
  addressNList: BIP32Path;
  showDisplay?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Arkeo {
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
    signatures: StdSignature[];
    memo?: string;
  }
}

export interface ArkeoTx {
  msg: Arkeo.Msg[];
  fee: Arkeo.StdFee;
  signatures: Arkeo.StdSignature[];
  memo?: string;
}

export interface ArkeoSignTx {
  addressNList: BIP32Path;
  tx: Arkeo.StdTx;
  chain_id: string;
  account_number: string;
  sequence: string;
  fee?: number;
}

export interface ArkeoSignedTx {
  serialized: string;
  body: string;
  authInfoBytes: string;
  signatures: string[];
}

export interface ArkeoGetAccountPaths {
  accountIdx: number;
}

export interface ArkeoAccountPath {
  addressNList: BIP32Path;
}

export interface ArkeoWalletInfo extends HDWalletInfo {
  readonly _supportsArkeoInfo: boolean;

  /**
   * Returns a list of bip32 paths for a given account index in preferred order
   * from most to least preferred.
   */
  arkeoGetAccountPaths(msg: ArkeoGetAccountPaths): Array<ArkeoAccountPath>;

  /**
   * Returns the "next" account path, if any.
   */
  arkeoNextAccountPath(msg: ArkeoAccountPath): ArkeoAccountPath | undefined;
}

export interface ArkeoWallet extends ArkeoWalletInfo, HDWallet {
  readonly _supportsArkeo: boolean;

  arkeoGetAddress(msg: ArkeoGetAddress): Promise<string | null>;
  arkeoSignTx(msg: ArkeoSignTx): Promise<ArkeoSignedTx | null>;
}

export function arkeoDescribePath(path: BIP32Path): PathDescription {
  const pathStr = addressNListToBIP32(path);
  const unknown: PathDescription = {
    verbose: pathStr,
    coin: "Arkeo",
    isKnown: false,
  };

  if (path.length != 5) {
    return unknown;
  }

  if (path[0] != 0x80000000 + 44) {
    return unknown;
  }

  if (path[1] != 0x80000000 + slip44ByCoin("Arkeo")) {
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
    verbose: `Arkeo Account #${index}`,
    accountIdx: index,
    wholeAccount: true,
    coin: "Arkeo",
    isKnown: true,
    isPrefork: false,
  };
}
