import { addressNListToBIP32, slip44ByCoin } from "./utils";
import { BIP32Path, PathDescription } from "./wallet";
import { FioActionParameters } from "fiosdk-offline";
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
    account?: FioActionParameters.FioActionAccount;
    name?: FioActionParameters.FioActionName;
    authorization?: Array<Fio.FioPermissionLevel>;
    data?: FioActionParameters.FioActionData;
  }
}

export interface FioSignTx {
  addressNList: BIP32Path;
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
  fioDecryptRequestContent(msg: FioRequestContent): Promise<string>;
  fioEncryptRequestContent(msg: FioRequestContent): Promise<string>;
}

export interface FioRequestContent {
  addressNList: BIP32Path;
  content: FioActionParameters.FioRequestContent;
  publicKey: string;
}

export function fioDescribePath(path: BIP32Path): PathDescription {
  let pathStr = addressNListToBIP32(path);
  let unknown: PathDescription = {
    verbose: pathStr,
    coin: "Fio",
    isKnown: false,
  };

  if (path.length != 5) {
    return unknown;
  }

  if (path[0] != 0x80000000 + 44) {
    return unknown;
  }

  if (path[1] != 0x80000000 + slip44ByCoin("Fio")) {
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
    verbose: `Fio Account #${index}`,
    accountIdx: index,
    wholeAccount: true,
    coin: "Fio",
    isKnown: true,
    isPrefork: false,
  };
}
