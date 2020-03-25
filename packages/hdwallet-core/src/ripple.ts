import { BIP32Path } from "./wallet";

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
    pub_key?: crypto.PubKey;
    signature: string;
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
  amount?: string;
  destination: string;
  destinationTag?: string;
}

export interface RippleSignTx {
  addressNList: BIP32Path;
  //tx: RippleTx;
  fee?: number;
  flags?: number;
  sequence?: number;
  lastLedgerSequence?: number;
  payment: RipplePayment;
  type: string;
  value: Ripple.StdTx;
}

export declare type RippleSignedTx = RippleTx;

export interface RippleWalletInfo {
  _supportsRippleInfo: boolean;

  /**
   * Returns a list of bip32 paths for a given account index in preferred order
   * from most to least preferred.
   */
  cosmosGetAccountPaths(msg: RippleGetAccountPaths): Array<RippleAccountPath>;

  /**
   * Returns the "next" account path, if any.
   */
  cosmosNextAccountPath(msg: RippleAccountPath): RippleAccountPath | undefined;
}

export interface RippleWallet extends RippleWalletInfo {
  _supportsRipple: boolean;

  cosmosGetAddress(msg: RippleGetAddress): Promise<string>;
  cosmosSignTx(msg: RippleSignTx): Promise<RippleSignedTx>;
}
