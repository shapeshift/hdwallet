import { BIP32Path, HDWallet, HDWalletInfo } from "./wallet";

export interface RippleGetAddress {
  addressNList: BIP32Path;
  showDisplay?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-namespace
declare namespace Ripple {
  // eslint-disable-next-line @typescript-eslint/no-namespace
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

  // eslint-disable-next-line @typescript-eslint/no-namespace
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
