import { BIP32Path } from "./wallet";
export interface FioGetAddress {
  addressNList: BIP32Path;
  showDisplay?: boolean;
  /** Optional. Required for showDisplay == true. */
  address?: string;
}

export interface FioGetAccountPaths {
  accountIdx: number;
}

export interface FioAccountPath {
  addressNList: BIP32Path;
}

export interface FioNextAccountPath {
  accountIdx: number;
}

export namespace Fio {
  export interface FioPermissionLevel {
    actor?: string;
    permission?: string;
  }

  export interface FioTxActionData {
    tpid?: string;
    actor?: string;
    [x: string]: any;
  }

  /* add action acks here as they are added to the wallet */
  export interface FioTxActionAck {
    account?: string;
    name?: string;
    authorization?: Array<Fio.FioPermissionLevel>;
    data?: Fio.FioTxActionData;
  }
}

export interface FioSignTx {
  expiration?: string;
  ref_block_num?: number;
  ref_block_prefix?: number;
  actions: Array<Fio.FioTxActionAck>;
}

export interface FioSignedTx {
  serialized: string;
  signature: string;
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
  fioGetAddress(msg: FioGetAddress): Promise<string>;
  fioSignTx(msg: FioSignTx): Promise<FioSignedTx>;
}
