import { addressNListToBIP32, slip44ByCoin } from "./utils";
import { BIP32Path, HDWallet, HDWalletInfo, PathDescription } from "./wallet";

export interface FioGetAddress {
  addressNList: BIP32Path;
  showDisplay?: boolean;
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

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Fio {
  export interface PermissionLevel {
    actor?: string;
    permission?: string;
  }

  export type PublicAddress = {
    chain_code: string;
    token_code: string;
    public_address: string;
  };

  export type FeeRatio = {
    end_point: string;
    value: number;
  };

  export enum ContentType {
    REQUEST = "new_funds_content",
    OBT = "record_obt_data_content",
  }

  export type RequestContent = {
    payee_public_address: string;
    amount: string;
    chain_code: string;
    token_code: string;
    memo: string;
    hash: string;
    offline_url: string;
  };

  export type OBTContent = {
    payee_public_address: string;
    payer_public_address: string;
    amount: string;
    chain_code: string;
    token_code: string;
    status: string;
    obt_id: string;
    memo: string;
    hash: string;
    offline_url: string;
  };

  export type Content<T> = T extends ContentType
    ? T extends ContentType.REQUEST
      ? RequestContent
      : T extends ContentType.OBT
      ? OBTContent
      : never
    : never;

  /* add action acks here as they are added to the wallet */
  export type TxActionAck = {
    authorization?: Array<PermissionLevel>;
    data: {
      max_fee?: number;
      tpid?: string;
      actor?: "";
    };
  } & (
    | {
        account: "fio.address";
        name: "addaddress";
        data: {
          fio_address: string;
          public_addresses: Array<PublicAddress>;
        };
      }
    | {
        account: "fio.reqobt";
        name: "newfundsreq";
        data: {
          payer_fio_address: string;
          payee_fio_address: string;
          content: string;
        };
      }
    | {
        account: "fio.reqobt";
        name: "recordobt";
        data: {
          payer_fio_address: string;
          payee_fio_address: string;
          content: string;
          fio_request_id?: string;
        };
      }
    | {
        account: "fio.address";
        name: "regaddress";
        data: {
          fio_address: string;
          owner_fio_public_key: string;
        };
      }
    | {
        account: "fio.address";
        name: "regdomain";
        data: {
          fio_domain: string;
          owner_fio_public_key: string;
        };
      }
    | {
        account: "fio.reqobt";
        name: "rejectfndreq";
        data: {
          fio_request_id: string;
        };
      }
    | {
        account: "fio.address";
        name: "renewaddress";
        data: {
          fio_address: string;
        };
      }
    | {
        account: "fio.address";
        name: "renewdomain";
        data: {
          fio_domain: string;
        };
      }
    | {
        account: "fio.address";
        name: "setdomainpub";
        data: {
          fio_domain: string;
          is_public: boolean;
        };
      }
    | {
        account: "fio.token";
        name: "trnsfiopubky";
        data: {
          payee_public_key: string;
          amount: string;
        };
      }
  );

  export type ActionName = TxActionAck["name"];
  export type ActionAccount = TxActionAck["account"];
  export type ActionData = TxActionAck["data"];

  // for compatibility
  export type FioPermissionLevel = PermissionLevel;
  export type FioTxActionAck = TxActionAck;
  export type FioTxActionData = ActionData;
}

export type FioEncryptionContentType = Fio.ContentType;
export const FioEncryptionContentType = Fio.ContentType;

export interface FioSignTx {
  addressNList: BIP32Path;
  expiration?: string;
  ref_block_num?: number;
  ref_block_prefix?: number;
  actions: [Fio.TxActionAck];
}

export interface FioSignedTx {
  serialized: string;
  signature: string;
}

export interface FioWalletInfo extends HDWalletInfo {
  readonly _supportsFioInfo: boolean;

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

export type FioEncryptRequestContentMsg<T extends Fio.ContentType> = {
  addressNList: BIP32Path;
  content: Fio.Content<T>;
  publicKey: string;
  contentType: T;
  iv?: Uint8Array;
};

export type FioDecryptRequestContentMsg<T extends Fio.ContentType = Fio.ContentType> = {
  addressNList: BIP32Path;
  content: string;
  publicKey: string;
  contentType: T;
};

export interface FioWallet extends FioWalletInfo, HDWallet {
  readonly _supportsFio: boolean;
  fioGetAddress(msg: FioGetAddress): Promise<string | null>;
  fioSignTx(msg: FioSignTx): Promise<FioSignedTx | null>;
  fioEncryptRequestContent<T extends Fio.ContentType>(msg: FioEncryptRequestContentMsg<T>): Promise<string | null>;
  fioDecryptRequestContent<T extends Fio.ContentType>(
    msg: FioDecryptRequestContentMsg<T>
  ): Promise<Fio.Content<T> | null>;
}

export function fioDescribePath(path: BIP32Path): PathDescription {
  const pathStr = addressNListToBIP32(path);
  const unknown: PathDescription = {
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

  const index = path[2] & 0x7fffffff;
  return {
    verbose: `Fio Account #${index}`,
    accountIdx: index,
    wholeAccount: true,
    coin: "Fio",
    isKnown: true,
    isPrefork: false,
  };
}
