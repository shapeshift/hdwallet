import * as ta from "type-assertions";

import { addressNListToBIP32, slip44ByCoin } from "./utils";
import { BIP32Path, Coin, ExchangeType, HDWallet, HDWalletInfo, PathDescription } from "./wallet";

// GuardedUnion<T> will ensure a static typechecking error if any properties are set that aren't supposed
// to be present on the specific union member being passed in. (This also helps the compiler with type inference.)
type MakeFalsy<T> = T extends boolean ? false : undefined;
type DistributiveKeyOf<T> = T extends any ? keyof T : never;
type DistributiveFalsyValueOf<T, U> = T extends any ? (U extends keyof T ? MakeFalsy<T[U]> : never) : never;
type FalsyValuesOfUnion<T> = {
  [Prop in DistributiveKeyOf<T>]?: DistributiveFalsyValueOf<T, Prop>;
};
type OnlyNecessaryProps<T, U> = T & Omit<FalsyValuesOfUnion<U>, keyof T>;
type GuardedUnionInner<T, U> = T extends any ? OnlyNecessaryProps<T, U> : never;
type GuardedUnion<T> = GuardedUnionInner<T, T>;

export type BTCGetAddress = {
  coin: Coin;
  addressNList: BIP32Path;
  scriptType?: BTCInputScriptType; // Defaults to BTCInputScriptType.SpendAddress
  showDisplay?: boolean;
};

export interface BitcoinScriptSig {
  hex: string;
}

/**
 * Deserialized representation of an already-signed input of a transaction.
 */
interface BitcoinInputBase {
  sequence: number;
}
export type BitcoinInput = GuardedUnion<
  | (BitcoinInputBase & { coinbase: string })
  | (BitcoinInputBase & { scriptSig: BitcoinScriptSig; txid: string; vout: number })
>;

/**
 * Deserialized representation of an already-signed output of a transaction.
 */
export interface BitcoinOutput {
  value: string; // UGH, Insight
  scriptPubKey: BitcoinScriptSig;
}

/**
 * De-serialized representation of an already-signed transaction.
 */
export interface BitcoinTxBase {
  version: number;
  locktime: number;
  vin: Array<BitcoinInput>;
  vout: Array<BitcoinOutput>;
}

type BitcoinTxDIP2 = BitcoinTxBase & {
  type: number;
  extraPayload: string;
};

export type BitcoinTx = GuardedUnion<BitcoinTxBase | BitcoinTxDIP2>;

/**
 * Input for a transaction we're about to sign.
 */
type BTCSignTxInputBase = {
  vout: number;
  addressNList: BIP32Path;
  amount?: string;
};

type BTCSignTxInputNativeBase = BTCSignTxInputBase & {
  txid: string;
};

type BTCSignTxInputNativeSegwitBase = BTCSignTxInputNativeBase & {
  scriptType: BTCInputScriptType.SpendWitness | BTCInputScriptType.SpendP2SHWitness;
};

type BTCSignTxInputNativeSegwitWithHex = BTCSignTxInputNativeSegwitBase & {
  hex: string;
};

type BTCSignTxInputNativeSegwitWithTx = BTCSignTxInputNativeSegwitBase & {
  tx: BitcoinTx;
  vout: number;
  amount: string;
};

type BTCSignTxInputNativeSegwit = BTCSignTxInputNativeSegwitWithHex | BTCSignTxInputNativeSegwitWithTx;

type BTCSignTxInputNativeNonSegwit = BTCSignTxInputNativeBase & {
  scriptType: Exclude<BTCInputScriptType, BTCSignTxInputNativeSegwit["scriptType"]>;
  hex: string;
};

type BTCSignTxInputNativeUnguarded = BTCSignTxInputNativeSegwit | BTCSignTxInputNativeNonSegwit;
export type BTCSignTxInputNative = GuardedUnion<BTCSignTxInputNativeUnguarded>;

type BTCSignTxInputKKBase = BTCSignTxInputBase & {
  txid: string;
  amount: string;
  sequence?: number;
};

type BTCSignTxInputKKSegwit = BTCSignTxInputKKBase & {
  scriptType: BTCInputScriptType.SpendWitness | BTCInputScriptType.SpendP2SHWitness | BTCInputScriptType.External;
  hex?: string;
};

type BTCSignTxInputKKNonSegwit = BTCSignTxInputKKBase & {
  scriptType: Exclude<BTCInputScriptType, BTCSignTxInputKKSegwit["scriptType"]>;
} & (
    | {
        tx: BitcoinTx;
      }
    | {
        hex: string;
      }
  );

type BTCSignTxInputKKUnguarded = BTCSignTxInputKKNonSegwit | BTCSignTxInputKKSegwit;
export type BTCSignTxInputKK = GuardedUnion<BTCSignTxInputKKUnguarded>;

export type BTCSignTxInputTrezor = BTCSignTxInputBase & {
  txid: string;
  amount: string;
  scriptType: BTCInputScriptType;
};

export type BTCSignTxInputLedger = BTCSignTxInputBase & {
  addressNList: BIP32Path;
  scriptType: BTCInputScriptType;
  hex: string;
};

export type BTCSignTxInput = BTCSignTxInputNative & BTCSignTxInputKK & BTCSignTxInputTrezor & BTCSignTxInputLedger;
export type BTCSignTxInputUnguarded = BTCSignTxInputNativeUnguarded &
  BTCSignTxInputKKUnguarded &
  BTCSignTxInputTrezor &
  BTCSignTxInputLedger;

// Stick to this common subset of input fields to avoid type hell.
export type BTCSignTxInputSafe = {
  addressNList: BIP32Path;
  scriptType: BTCInputScriptType;
  hex: string;
  txid: string;
  amount: string;
  vout: number;
};
ta.assert<ta.Extends<BTCSignTxInputSafe, BTCSignTxInput>>();

/**
 * Output for a transaction we're about to sign.
 */
export type BTCSignTxOutputSpend = {
  addressType?: BTCOutputAddressType.Spend;
  amount: string;
  address: string;
};

// Will make address type more specific on TS version bump.
export type BTCSignTxOutputSpendP2PKH = {
  addressType?: BTCOutputAddressType.Spend;
  amount: string;
  address: string;
  scriptType: BTCOutputScriptType.PayToAddress;
};

export type BTCSignTxOutputSpendP2SH = {
  addressType?: BTCOutputAddressType.Spend;
  amount: string;
  address: string;
  scriptType: BTCOutputScriptType.PayToMultisig | BTCOutputScriptType.PayToP2SHWitness;
};

export type BTCSignTxOutputSpendP2WPKH = {
  addressType?: BTCOutputAddressType.Spend;
  amount: string;
  address: string;
  scriptType: BTCOutputScriptType.PayToWitness;
};

export type BTCSignTxOutputTransfer = {
  addressType: BTCOutputAddressType.Transfer;
  amount: string;
  /** bip32 path for destination (device must `btcSupportsSecureTransfer()`) */
  addressNList: BIP32Path;
  scriptType: BTCOutputScriptType;
};

export type BTCSignTxOutputChange = {
  addressType: BTCOutputAddressType.Change;
  amount: string;
  /** bip32 path for destination (device must `btcSupportsSecureTransfer()`) */
  addressNList: BIP32Path;
  scriptType: BTCOutputScriptType;
  isChange: true;
};

export type BTCSignTxOutputExchange = {
  /**
   * Device must `btcSupportsNativeShapeShift()`
   */
  addressType: BTCOutputAddressType.Exchange;
  amount: string;
  exchangeType: ExchangeType;
};

export type BTCSignTxOutputMemo = {
  addressType?: BTCOutputAddressType.Spend;
  amount?: "0";
  opReturnData: string | Uint8Array;
};

export type BTCSignTxOutput = GuardedUnion<
  | BTCSignTxOutputSpend
  | BTCSignTxOutputSpendP2PKH
  | BTCSignTxOutputSpendP2SH
  | BTCSignTxOutputSpendP2WPKH
  | BTCSignTxOutputTransfer
  | BTCSignTxOutputChange
  | BTCSignTxOutputExchange
  | BTCSignTxOutputMemo
>;

export interface BTCSignTx {
  coin: string;
  inputs: Array<BTCSignTxInput>;
  outputs: Array<BTCSignTxOutput>;
  version?: number;
  locktime?: number;
  opReturnData?: string; // TODO: dump this in favor of BTCSignTxOutputMemo above
  vaultAddress?: string;
}

export type BTCSignTxKK = Omit<BTCSignTx, "inputs"> & { inputs: Array<BTCSignTxInputKK> };
export type BTCSignTxNative = Omit<BTCSignTx, "inputs"> & { inputs: Array<BTCSignTxInputNative> };
export type BTCSignTxTrezor = Omit<BTCSignTx, "inputs"> & { inputs: Array<BTCSignTxInputTrezor> };
export type BTCSignTxLedger = Omit<BTCSignTx, "inputs"> & { inputs: Array<BTCSignTxInputLedger> };

export interface BTCSignedTx {
  signatures: Array<string>;

  /** hex string representation of the raw, signed transaction */
  serializedTx: string;
}

// Bech32 info https://en.bitcoin.it/wiki/BIP_0173
export enum BTCInputScriptType {
  CashAddr = "cashaddr", // for Bitcoin Cash
  Bech32 = "bech32",
  SpendAddress = "p2pkh",
  SpendMultisig = "p2sh",
  External = "external",
  SpendWitness = "p2wpkh",
  SpendP2SHWitness = "p2sh-p2wpkh",
}

export enum BTCOutputScriptType {
  PayToAddress = "p2pkh",
  PayToMultisig = "p2sh",
  Bech32 = "bech32",
  PayToWitness = "p2wpkh",
  PayToP2SHWitness = "p2sh-p2wpkh",
}

export enum BTCOutputAddressType {
  Spend = "spend",
  Transfer = "transfer",
  Change = "change",
  Exchange = "exchange",
}

export interface BTCSignMessage {
  addressNList: BIP32Path;
  coin: Coin;
  scriptType?: BTCInputScriptType;
  message: string;
}

export interface BTCSignedMessage {
  address: string;
  signature: string;
}

export interface BTCVerifyMessage {
  address: string;
  message: string;
  signature: string;
  coin: Coin;
}

export interface BTCGetAccountPaths {
  coin: Coin;
  accountIdx: number;
  scriptType?: BTCInputScriptType;
}

export interface BTCAccountPath {
  coin: Coin;
  scriptType: BTCInputScriptType;
  addressNList: BIP32Path;
}

export interface BTCWalletInfo extends HDWalletInfo {
  readonly _supportsBTCInfo: boolean;

  /**
   * Does the device support the given UTXO coin?
   */
  btcSupportsCoin(coin: Coin): Promise<boolean>;

  /**
   * Does the device support the given script type for the given coin?
   * Assumes that `btcSupportsCoin(coin)` for the given coin.
   */
  btcSupportsScriptType(coin: Coin, scriptType?: BTCInputScriptType): Promise<boolean>;

  /**
   * Does the device support internal transfers without the user needing to
   * confirm the destination address?
   */
  btcSupportsSecureTransfer(): Promise<boolean>;

  /**
   * Does the device support `/sendamountProto2` style ShapeShift trades?
   */
  btcSupportsNativeShapeShift(): boolean;

  /**
   * Returns a list of bip32 paths for a given account index in preferred order
   * from most to least preferred.
   *
   * For forked coins, eg. BSV, this would return:
   ```plaintext
      p2pkh m/44'/236'/a'
      p2pkh m/44'/230'/a'
      p2pkh m/44'/0'/a'
   ```
   *
   * For BTC it might return:
   ```plaintext
      p2sh-p2pkh m/49'/0'/a'
      p2pkh      m/44'/0'/a'
      p2sh-p2wsh m/44'/0'/a'
   ```
   */
  btcGetAccountPaths(msg: BTCGetAccountPaths): Array<BTCAccountPath>;

  /**
   * Does the device support spending from the combined accounts?
   * The list is assumed to contain unique entries.
   */
  btcIsSameAccount(msg: Array<BTCAccountPath>): boolean;

  /**
   * Returns the "next" account path, if any.
   */
  btcNextAccountPath(msg: BTCAccountPath): BTCAccountPath | undefined;
}

export interface BTCWallet extends BTCWalletInfo, HDWallet {
  readonly _supportsBTC: boolean;

  btcGetAddress(msg: BTCGetAddress): Promise<string | null>;
  btcSignTx(msg: BTCSignTx): Promise<BTCSignedTx | null>;
  btcSignMessage(msg: BTCSignMessage): Promise<BTCSignedMessage | null>;
  btcVerifyMessage(msg: BTCVerifyMessage): Promise<boolean | null>;
}

export function unknownUTXOPath(path: BIP32Path, coin: Coin, scriptType?: BTCInputScriptType): PathDescription {
  return {
    verbose: addressNListToBIP32(path),
    coin,
    scriptType,
    isKnown: false,
  };
}

export function describeUTXOPath(path: BIP32Path, coin: Coin, scriptType: BTCInputScriptType): PathDescription {
  const unknown = unknownUTXOPath(path, coin, scriptType);

  if (path.length !== 3 && path.length !== 5) return unknown;

  if ((path[0] & 0x80000000) >>> 0 !== 0x80000000) return unknown;

  const purpose = path[0] & 0x7fffffff;

  if (![44, 49, 84].includes(purpose)) return unknown;

  if (purpose === 44 && scriptType !== BTCInputScriptType.SpendAddress) return unknown;

  if (purpose === 49 && scriptType !== BTCInputScriptType.SpendP2SHWitness) return unknown;

  const wholeAccount = path.length === 3;

  const script = (
    {
      [BTCInputScriptType.SpendAddress]: ["Legacy"],
      [BTCInputScriptType.SpendP2SHWitness]: [],
      [BTCInputScriptType.SpendWitness]: ["Segwit"],
      [BTCInputScriptType.Bech32]: ["Segwit Native"],
    } as Partial<Record<BTCInputScriptType, string[]>>
  )[scriptType];

  let isPrefork = false;
  const slip44 = slip44ByCoin(coin);
  if (slip44 === undefined) return unknown;
  if (path[1] !== 0x80000000 + slip44) {
    switch (coin) {
      case "BitcoinCash":
      case "BitcoinGold": {
        if (path[1] === 0x80000000 + slip44ByCoin("Bitcoin")) {
          isPrefork = true;
          break;
        }
        return unknown;
      }
      case "BitcoinSV": {
        if (path[1] === 0x80000000 + slip44ByCoin("Bitcoin") || path[1] === 0x80000000 + slip44ByCoin("BitcoinCash")) {
          isPrefork = true;
          break;
        }
        return unknown;
      }
      default:
        return unknown;
    }
  }

  let attributes = isPrefork ? ["Prefork"] : [];
  switch (coin) {
    case "Bitcoin":
    case "Litecoin":
    case "BitcoinGold":
    case "Testnet": {
      if (script) attributes = attributes.concat(script);
      break;
    }
    default:
      break;
  }

  const attr = attributes.length ? ` (${attributes.join(", ")})` : "";

  const accountIdx = path[2] & 0x7fffffff;

  if (wholeAccount) {
    return {
      coin,
      verbose: `${coin} Account #${accountIdx}${attr}`,
      accountIdx,
      wholeAccount: true,
      isKnown: true,
      scriptType,
      isPrefork,
    };
  } else {
    const change = path[3] === 1 ? "Change " : "";
    const addressIdx = path[4];
    return {
      coin,
      verbose: `${coin} Account #${accountIdx}, ${change}Address #${addressIdx}${attr}`,
      accountIdx,
      addressIdx,
      wholeAccount: false,
      isKnown: true,
      isChange: path[3] === 1,
      scriptType,
      isPrefork,
    };
  }
}

export function legacyAccount(coin: Coin, slip44: number, accountIdx: number): BTCAccountPath {
  return {
    coin,
    scriptType: BTCInputScriptType.SpendAddress,
    addressNList: [0x80000000 + 44, 0x80000000 + slip44, 0x80000000 + accountIdx],
  };
}

export function segwitAccount(coin: Coin, slip44: number, accountIdx: number): BTCAccountPath {
  return {
    coin,
    scriptType: BTCInputScriptType.SpendP2SHWitness,
    addressNList: [0x80000000 + 49, 0x80000000 + slip44, 0x80000000 + accountIdx],
  };
}

export function segwitNativeAccount(coin: Coin, slip44: number, accountIdx: number): BTCAccountPath {
  return {
    coin,
    scriptType: BTCInputScriptType.SpendWitness,
    addressNList: [0x80000000 + 84, 0x80000000 + slip44, 0x80000000 + accountIdx],
  };
}
