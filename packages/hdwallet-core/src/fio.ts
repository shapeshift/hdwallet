import { BIP32Path } from "./wallet";


export interface FioGetPublicKey {
  addressNList: BIP32Path;
  showDisplay?: boolean;
}

export interface FioGetAccountPaths {
  accountIdx: number;
}

export interface FioAccountPath {
  addressNList: BIP32Path;
}

export interface fioNextAccountPath {
  accountIdx: number;
}

export namespace Fio {
  export interface FioPermissionLevel {
    actor?: string;
    permission?: string;
  }

  /* add action acks here as they are added to the wallet */
  export interface FioTxActionAck {
    account?: string;
    name?: string;
    authorization?: Array<Fio.FioPermissionLevel>;
    data?: any;
  }
}

export interface FioTx {
  expiration?: string;
  ref_block_num?: number;
  ref_block_prefix?: number;
  max_net_usage_words?: number;
  max_cpu_usage_ms?: number;
  delay_sec?: number;
  actions: Array<Fio.FioTxActionAck>; // could be several kinds of actions
}

export interface FioToSignTx {
  addressNList: BIP32Path;
  chain_id: string;
  tx: FioTx;
}

/* device response asking for next action */
export interface FioTxActionRequest {}

/*
export interface FioTxSigned {
  signatureV?: number;
  signatureR: Uint8Array | string;
  signatureS: Uint8Array | string;
  hash: Uint8Array | string;
  fioFormSig: string;
}
*/

export interface FioTxSigned {
  signatureV?: number;
  signatureR?: Uint8Array;
  signatureS?: Uint8Array;
  hash?: Uint8Array;
  serialized?: string;
  fioFormSig: string;
}

export interface FioWalletInfo {
  _supportsFioInfo: boolean;

  /**
   * Returns a list of bip32 paths for a given account index in preferred order
   * from most to least preferred.
   */
  fioGetAccountPaths(msg: FioGetAccountPaths): Array<FioAccountPath>;

  /**
   * Returns the "next" account path, if any.
   */
  fioNextAccountPath(msg: FioAccountPath): FioAccountPath | undefined;
}

export interface FioWallet extends FioWalletInfo {
  _supportsFio: boolean;

  fioGetPublicKey(msg: FioGetPublicKey): Promise<string>;
  fioSignTx(msg: FioToSignTx): Promise<FioTxSigned>;
}
