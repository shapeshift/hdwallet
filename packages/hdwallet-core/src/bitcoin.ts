import { ExchangeType, BIP32Path, Coin, PathDescription } from "./wallet";
import { addressNListToBIP32, slip44ByCoin } from "./utils";

export interface BTCGetAddress {
  addressNList: BIP32Path;
  coin: Coin;
  showDisplay?: boolean;
  scriptType?: BTCInputScriptType;
  /** Optional. Required for showDisplay == true. */
  address?: string;
}

export interface BitcoinScriptSig {
  hex: string;
}

/**
 * Deserialized representation of an already-signed input of a transaction.
 */
export interface BitcoinInput {
  vout?: number;
  valueSat?: number;
  sequence?: number;
  scriptSig?: BitcoinScriptSig;
  txid?: string;
  coinbase?: string;
}

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
export interface BitcoinTx {
  version: number;
  locktime: number;
  vin: Array<BitcoinInput>;
  vout: Array<BitcoinOutput>;

  type?: number; // Dash
  extraPayload?: string; // Dash
  extraPayloadSize?: number; // Dash
}

/**
 * Input for a transaction we're about to sign.
 */
export interface BTCSignTxInput {
  /** bip32 path to sign the input with */
  addressNList: BIP32Path;
  scriptType?: BTCInputScriptType;
  sequence?: number;
  amount: string;
  vout: number;
  txid: string;
  tx?: BitcoinTx; // Required for p2sh, not required for segwit
  hex: string;
  sighashType?:string,
  type?: number; // Dash
  extraPayloadSize?: number; // Dash
  extraPayload?: string; // Dash
}

/**
 * Output for a transaction we're about to sign.
 */
export interface BTCSignTxOutput {
  /** bip32 path for destination (device must `btcSupportsSecureTransfer()`) */
  addressNList?: BIP32Path;
  scriptType?: BTCOutputScriptType;
  address?: string;
  addressType: BTCOutputAddressType;
  amount: string;
  isChange: boolean;
  /**
   * Device must `btcSupportsNativeShapeShift()`
   */
  exchangeType?: ExchangeType;
  opReturnData?: string;
}

export interface BTCSignTx {
  coin: string;
  inputs: Array<BTCSignTxInput>;
  outputs: Array<BTCSignTxOutput>;
  version?: number;
  locktime?: number;
  opReturnData?: string;
  vaultAddress?: string;
}

export interface BTCSignedTx {
  signatures: Array<string>;

  /** hex string representation of the raw, signed transaction */
  serializedTx: string;
}

export enum BTCInputScriptType {
  CashAddr = "cashaddr", // for Bitcoin Cash
  Bech32 = 'bech32',
  SpendAddress = "p2pkh",
  SpendMultisig = "p2sh",
  External = "external",
  SpendWitness = "p2wpkh",
  SpendP2SHWitness = "p2sh-p2wpkh",
}

export enum BTCOutputScriptType {
  PayToAddress = "p2pkh",
  PayToMultisig = "p2sh",
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
  coin?: Coin;
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

export interface BTCWalletInfo {
  _supportsBTCInfo: boolean;

  /**
   * Does the device support the given UTXO coin?
   */
  btcSupportsCoin(coin: Coin): Promise<boolean>;

  /**
   * Does the device support the given script type for the given coin?
   * Assumes that `btcSupportsCoin(coin)` for the given coin.
   */
  btcSupportsScriptType(coin: Coin, scriptType: BTCInputScriptType): Promise<boolean>;

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

export interface BTCWallet extends BTCWalletInfo {
  _supportsBTC: boolean;

  btcGetAddress(msg: BTCGetAddress): Promise<string>;
  btcSignTx(msg: BTCSignTx): Promise<BTCSignedTx>;
  btcSignMessage(msg: BTCSignMessage): Promise<BTCSignedMessage>;
  btcVerifyMessage(msg: BTCVerifyMessage): Promise<boolean>;
}

export function unknownUTXOPath(path: BIP32Path, coin: Coin, scriptType: BTCInputScriptType): PathDescription {
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

  let purpose = path[0] & 0x7fffffff;

  if (![44, 49, 84].includes(purpose)) return unknown;

  if (purpose === 44 && scriptType !== BTCInputScriptType.SpendAddress) return unknown;

  if (purpose === 49 && scriptType !== BTCInputScriptType.SpendP2SHWitness) return unknown;

  if (purpose === 84 && scriptType !== BTCInputScriptType.SpendWitness) return unknown;

  let wholeAccount = path.length === 3;

  let script = {
    [BTCInputScriptType.SpendAddress]: ["Legacy"],
    [BTCInputScriptType.SpendP2SHWitness]: [],
    [BTCInputScriptType.SpendWitness]: ["Segwit Native"],
  }[scriptType];

  let isPrefork = false;
  if (path[1] !== 0x80000000 + slip44ByCoin(coin)) {
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
      attributes = attributes.concat(script);
      break;
    }
    default:
      break;
  }

  let attr = attributes.length ? ` (${attributes.join(", ")})` : "";

  let accountIdx = path[2] & 0x7fffffff;

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
    let change = path[3] === 1 ? "Change " : "";
    let addressIdx = path[4];
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
