import { addressNListToBIP32, PathDescription, slip44ByCoin } from ".";
import { BIP32Path, HDWallet, HDWalletInfo } from "./wallet";

export interface RippleGetAddress {
  addressNList: BIP32Path;
  showDisplay?: boolean;
}
declare namespace Ripple {
  namespace sdk {
    interface Msg {
      type: string;
      value: any;
    }
    type Coins = Coin[];
    interface Coin {
      denom: string;
      amount: string;
    }
  }

  interface StdFee {
    amount: sdk.Coins;
    gas: string;
  }
  namespace crypto {
    interface PubKey {
      type: string;
      value: string;
    }
  }

  interface StdSignature {
    signature: string;
    serializedTx: string;
  }

  interface StdTx {
    msg: sdk.Msg[];
    fee: StdFee;
    signatures: null | StdSignature[];
    memo: string;
  }
}

export interface RippleTx {
  type: string;
  value: Ripple.StdTx;
}

export interface RipplePayment {
  amount: string;
  destination: string;
  destinationTag?: string;
}

export interface RippleSignTx {
  addressNList: BIP32Path;
  tx: RippleTx;
  flags?: string;
  sequence: string;
  lastLedgerSequence: string;
  payment: RipplePayment;
}

export declare type RippleSignedTx = RippleTx;

export interface RippleGetAccountPaths {
  accountIdx: number;
}

export interface RippleAccountPath {
  addressNList: BIP32Path;
}

export interface RippleWalletInfo extends HDWalletInfo {
  readonly _supportsRippleInfo: boolean;

  /**
   * Returns a list of bip32 paths for a given account index in preferred order
   * from most to least preferred.
   */
  rippleGetAccountPaths(msg: RippleGetAccountPaths): Array<RippleAccountPath>;

  /**
   * Returns the "next" account path, if any.
   */
  rippleNextAccountPath(msg: RippleAccountPath): RippleAccountPath | undefined;
}

export interface RippleWallet extends RippleWalletInfo, HDWallet {
  readonly _supportsRipple: boolean;

  rippleGetAddress(msg: RippleGetAddress): Promise<string | null>;
  rippleSignTx(msg: RippleSignTx): Promise<RippleSignedTx | null>;
}

export function rippleDescribePath(path: BIP32Path): PathDescription {
  let pathStr = addressNListToBIP32(path);
  let unknown: PathDescription = {
    verbose: pathStr,
    coin: "Ripple",
    isKnown: false,
  };

  if (path.length != 5) {
    return unknown;
  }

  if (path[0] != 0x80000000 + 44) {
    return unknown;
  }

  if (path[1] != 0x80000000 + slip44ByCoin("Ripple")) {
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
    verbose: `Ripple Account #${index}`,
    accountIdx: index,
    wholeAccount: true,
    coin: "Ripple",
    isKnown: true,
    isPrefork: false,
  };
}
