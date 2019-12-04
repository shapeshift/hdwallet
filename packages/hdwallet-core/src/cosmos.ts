import { BIP32Path } from './wallet'

export interface CosmosGetAddress {
  addressNList: BIP32Path,
  showDisplay?: boolean,
  /** Optional. Required for showDisplay == true. */
  address?: string,
}

export interface CosmosSignTx {

}

export interface CosmosSignedTx {

}

export interface CosmosGetAccountPaths {
  accountIdx: number
}

export interface CosmosAccountPath {
  addressNList: BIP32Path
}

export interface CosmosWalletInfo {
  _supportsCosmosInfo: boolean

  /**
   * Returns a list of bip32 paths for a given account index in preferred order
   * from most to least preferred.
   */
  cosmosGetAccountPaths (msg: CosmosGetAccountPaths): Array<CosmosAccountPath>

  /**
   * Returns the "next" account path, if any.
   */
  cosmosNextAccountPath (msg: CosmosAccountPath): CosmosAccountPath | undefined
}

export interface CosmosWallet extends CosmosWalletInfo {
  _supportsCosmos: boolean

  cosmosGetAddress (msg: CosmosGetAddress): Promise<string>
  cosmosSignTx (msg: CosmosSignTx): Promise<CosmosSignedTx>
}
