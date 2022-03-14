import { BIP32Path, HDWallet, HDWalletInfo } from "./wallet";

export interface EosGetPublicKey {
  addressNList: Array<number>;
  showDisplay?: boolean;
  kind: 0 | 1 | 2;
}

export interface EosGetAccountPaths {
  accountIdx: number;
}

export interface EosAccountPath {
  addressNList: BIP32Path;
}

export interface eosNextAccountPath {
  accountIdx: number;
}

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Eos {
  export interface EosPermissionLevel {
    actor: string;
    permission: string;
  }

  /* add action acks here as they are added to the wallet */
  export interface EosTxActionAck {
    account: string;
    name: string;
    authorization: Array<Eos.EosPermissionLevel>;
    data: any;
  }
}

export interface EosTx {
  expiration: string;
  ref_block_num: number;
  ref_block_prefix: number;
  max_net_usage_words: number;
  max_cpu_usage_ms: number;
  delay_sec: number;
  actions: [Eos.EosTxActionAck]; // could be several kinds of actions
}

export interface EosToSignTx {
  addressNList: BIP32Path;
  chain_id: string;
  tx: EosTx;
}

/* device response asking for next action */
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface EosTxActionRequest {}

/*
export interface EosTxSigned {
  signatureV?: number;
  signatureR: Uint8Array | string;
  signatureS: Uint8Array | string;
  hash: Uint8Array | string;
  eosFormSig: string;
}
*/

export interface EosTxSigned {
  signatureV: number;
  signatureR: Uint8Array;
  signatureS: Uint8Array;
  hash: Uint8Array;
  eosFormSig: string;
}

export interface EosWalletInfo extends HDWalletInfo {
  readonly _supportsEosInfo: boolean;

  /**
   * Returns a list of bip32 paths for a given account index in preferred order
   * from most to least preferred.
   */
  eosGetAccountPaths(msg: EosGetAccountPaths): Array<EosAccountPath>;

  /**
   * Returns the "next" account path, if any.
   */
  eosNextAccountPath(msg: EosAccountPath): EosAccountPath | undefined;
}

export interface EosWallet extends EosWalletInfo, HDWallet {
  readonly _supportsEos: boolean;

  eosGetPublicKey(msg: EosGetPublicKey): Promise<string | null>;
  eosSignTx(msg: EosToSignTx): Promise<EosTxSigned | null>;
}
