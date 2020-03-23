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
  tx: RippleTx;
  flags: string;
  sequence: string;
  lastLedgerSequence: string;
  payment: RipplePayment;
}

export declare type RippleSignedTx = RippleTx;
