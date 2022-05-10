import { addressNListToBIP32, slip44ByCoin } from "./utils";
import { BIP32Path, HDWallet, HDWalletInfo, PathDescription } from "./wallet";

export interface SecretGetAddress {
  addressNList: BIP32Path;
  showDisplay?: boolean;
  testnet?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Secret {
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

export interface SecretTx {
  msg: Secret.Msg[];
  fee: Secret.StdFee;
  signatures: null | Secret.StdSignature[];
  memo: string;
}

export interface SecretSignTx {
  addressNList: BIP32Path;
  tx: Secret.StdTx;
  chain_id: string;
  account_number: number;
  sequence: number;
  fee?: number;
  gas?: number;
  testnet?: boolean;
}

export type SecretSignedTx = SecretTx;

export interface SecretGetAccountPaths {
  accountIdx: number;
}

export interface SecretAccountPath {
  addressNList: BIP32Path;
}

export interface SecretWalletInfo extends HDWalletInfo {
  readonly _supportsSecretInfo: boolean;

  /**
   * Returns a list of bip32 paths for a given account index in preferred order
   * from most to least preferred.
   */
  secretGetAccountPaths(msg: SecretGetAccountPaths): Array<SecretAccountPath>;

  /**
   * Returns the "next" account path, if any.
   */
  secretNextAccountPath(msg: SecretAccountPath): SecretAccountPath | undefined;
}

export interface SecretWallet extends SecretWalletInfo, HDWallet {
  readonly _supportsSecret: boolean;

  secretGetAddress(msg: SecretGetAddress): Promise<string | null>;
  secretSignTx(msg: SecretSignTx): Promise<SecretSignedTx | null>;
}

export function secretDescribePath(path: BIP32Path): PathDescription {
  const pathStr = addressNListToBIP32(path);
  const unknown: PathDescription = {
    verbose: pathStr,
    coin: "Secret",
    isKnown: false,
  };

  if (path.length != 5) {
    return unknown;
  }

  if (path[0] != 0x80000000 + 44) {
    return unknown;
  }

  if (path[1] != 0x80000000 + slip44ByCoin("Secret")) {
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
    verbose: `Secret Account #${index}`,
    accountIdx: index,
    wholeAccount: true,
    coin: "Secret",
    isKnown: true,
    isPrefork: false,
  };
}
