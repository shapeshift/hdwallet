import { BIP32Path } from "./wallet";

export interface CosmosGetAddress {
  addressNList: BIP32Path;
  hardenedPath: BIP32Path;
  relPath: BIP32Path;
  showDisplay?: boolean;
  /** Optional. Required for showDisplay == true. */
  address?: string;
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
