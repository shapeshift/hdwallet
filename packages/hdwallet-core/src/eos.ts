import { BIP32Path } from './wallet'

export interface EosGetPublicKey {
  addressNList: BIP32Path,
  showDisplay?: boolean,
  /** Optional. Required for showDisplay == true. */
  kind?: boolean,
}

export interface EosGetAccountPaths {
  accountIdx: number
}

export interface EosAccountPath {
  addressNList: BIP32Path
}

export interface eosNextAccountPath {
    accountIdx: number
}

export interface EosWalletInfo {
  _supportsEosInfo: boolean

  /**
   * Returns a list of bip32 paths for a given account index in preferred order
   * from most to least preferred.
   */
  eosGetAccountPaths (msg: EosGetAccountPaths): Array<EosAccountPath>

  /**
   * Returns the "next" account path, if any.
   */
  eosNextAccountPath (msg: EosAccountPath): EosAccountPath | undefined
}

export interface EosWallet extends EosWalletInfo {
  _supportsEos: boolean

  eosGetPublicKey (msg: EosGetPublicKey): Promise<string>
}