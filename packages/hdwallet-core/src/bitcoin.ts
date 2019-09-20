import { ExchangeType, BIP32Path, Coin } from './wallet'

export interface BTCGetAddress {
  addressNList: BIP32Path,
  coin: Coin,
  showDisplay?: boolean,
  scriptType?: BTCInputScriptType,
  /** Optional. Required for showDisplay == true. */
  address?: string,
}

export interface BitcoinScriptSig {
  hex: string
}

/**
 * Deserialized representation of an already-signed input of a transaction.
 */
export interface BitcoinInput {
  vout?: number,
  valueSat?: number,
  sequence?: number,
  scriptSig?: BitcoinScriptSig,
  txid?: string,
  coinbase?: string,
}

/**
 * Deserialized representation of an already-signed output of a transaction.
 */
export interface BitcoinOutput {
  value: string, // UGH, Insight
  scriptPubKey: BitcoinScriptSig
}

/**
 * De-serialized representation of an already-signed transaction.
 */
export interface BitcoinTx {
  version: number,
  locktime: number,
  vin: Array<BitcoinInput>,
  vout: Array<BitcoinOutput>,

  type?: number,             // Dash
  extraPayload?: string,     // Dash
  extraPayloadSize?: number, // Dash
}

/**
 * Input for a transaction we're about to sign.
 */
export interface BTCSignTxInput {
  /** bip32 path to sign the input with */
  addressNList: BIP32Path,
  scriptType?: BTCInputScriptType,
  sequence?: number,
  amount: number,
  vout: number,
  txid: string,
  tx?: BitcoinTx, // Required for p2sh, not required for segwit
  hex: string,
  type?: number,              // Dash
  extraPayloadSize?: number,  // Dash
  extraPayload?: string,      // Dash
}

/**
 * Output for a transaction we're about to sign.
 */
export interface BTCSignTxOutput {
  /** bip32 path for destination (device must `btcSupportsSecureTransfer()`) */
  addressNList?: BIP32Path,
  scriptType?: BTCOutputScriptType,
  address?: string,
  addressType: BTCOutputAddressType,
  amount: number,
  isChange: boolean,
  /**
   * Device must `btcSupportsNativeShapeShift()`
   */
  exchangeType?: ExchangeType
}

export interface BTCSignTx {
  coin: string,
  inputs: Array<BTCSignTxInput>,
  outputs: Array<BTCSignTxOutput>,
  version?: number,
  locktime?: number,
}

export interface BTCSignedTx {
  signatures: Array<string>,

  /** hex string representation of the raw, signed transaction */
  serializedTx: string
}

export enum BTCInputScriptType {
  CashAddr = 'cashaddr', // for Bitcoin Cash
  SpendAddress = 'p2pkh',
  SpendMultisig = 'p2sh',
  External = 'external',
  SpendWitness = 'p2wpkh',
  SpendP2SHWitness = 'p2sh-p2wpkh',
}

export enum BTCOutputScriptType {
  PayToAddress = 'p2pkh',
  PayToMultisig = 'p2sh',
  PayToWitness = 'p2wpkh',
  PayToP2SHWitness = 'p2sh-p2wpkh'
}

export enum BTCOutputAddressType {
  Spend = 'spend',
  Transfer = 'transfer',
  Change = 'change',
  Exchange = 'exchange'
}

export interface BTCSignMessage {
  addressNList: BIP32Path,
  coin?: Coin,
  scriptType?: BTCInputScriptType,
  message: string
}

export interface BTCSignedMessage {
  address: string,
  signature: string
}

export interface BTCVerifyMessage {
  address: string,
  message: string,
  signature: string,
  coin: Coin
}

export interface BTCGetAccountPaths {
  coin: Coin,
  accountIdx: number,
  scriptType?: BTCInputScriptType
}

export interface BTCAccountPath {
  scriptType: BTCInputScriptType,
  addressNList: BIP32Path
}

export interface BTCWalletInfo {
  _supportsBTCInfo: boolean

  /**
   * Does the device support the given UTXO coin? 
   */
  btcSupportsCoin (coin: Coin): Promise<boolean>

  /**
   * Does the device support the given script type for the given coin?
   * Assumes that `btcSupportsCoin(coin)` for the given coin.
   */
  btcSupportsScriptType (coin: Coin, scriptType: BTCInputScriptType): Promise<boolean>

  /**
   * Does the device support internal transfers without the user needing to
   * confirm the destination address?
   */
  btcSupportsSecureTransfer (): Promise<boolean>

  /**
   * Does the device support `/sendamountProto2` style ShapeShift trades?
   */
  btcSupportsNativeShapeShift (): Promise<boolean>

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
  btcGetAccountPaths (msg: BTCGetAccountPaths): Array<BTCAccountPath>

  /**
   * Does the device support spending from the combined accounts?
   * The list is assumed to contain unique entries.
   */
  btcIsSameAccount (msg: Array<BTCAccountPath>): boolean
}

export interface BTCWallet extends BTCWalletInfo {
  _supportsBTC: boolean

  btcGetAddress (msg: BTCGetAddress): Promise<string>
  btcSignTx (msg: BTCSignTx): Promise<BTCSignedTx>
  btcSignMessage (msg: BTCSignMessage): Promise<BTCSignedMessage>
  btcVerifyMessage (msg: BTCVerifyMessage): Promise<boolean>
}