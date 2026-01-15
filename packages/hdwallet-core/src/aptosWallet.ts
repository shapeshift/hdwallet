import * as core from "./wallet";

export interface AptosGetAddress {
  addressNList: core.BIP32Path;
  showDisplay?: boolean;
}

export interface AptosSignTx {
  addressNList: core.BIP32Path;
  /** Transaction bytes to sign */
  transactionBytes: Uint8Array;
}

export interface AptosSignedTx {
  signature: string;
  publicKey: string;
}

export interface AptosGetAccountPaths {
  accountIdx: number;
}

export interface AptosAccountPath {
  addressNList: core.BIP32Path;
}

export interface AptosWalletInfo extends core.HDWalletInfo {
  readonly _supportsAptosInfo: boolean;

  /**
   * Returns a list of bip32 paths for a given account index in preferred order
   * from most to least preferred.
   */
  aptosGetAccountPaths(msg: AptosGetAccountPaths): Array<AptosAccountPath>;

  /**
   * Returns "next" account path, if any.
   */
  aptosNextAccountPath(msg: AptosAccountPath): AptosAccountPath | undefined;
}

export interface AptosWallet extends AptosWalletInfo, core.HDWallet {
  readonly _supportsAptos: boolean;

  aptosGetAddress(msg: AptosGetAddress): Promise<string | null>;
  aptosGetAddresses?(msgs: AptosGetAddress[]): Promise<string[]>;
  aptosSignTx(msg: AptosSignTx): Promise<AptosSignedTx | null>;
}

export function aptosDescribePath(path: core.BIP32Path): core.PathDescription {
  const pathStr = core.addressNListToBIP32(path);
  const unknown: core.PathDescription = {
    verbose: pathStr,
    coin: "Aptos",
    isKnown: false,
  };

  if (path.length != 5) return unknown;
  if (path[0] != 0x80000000 + 44) return unknown;
  if (path[1] != 0x80000000 + core.slip44ByCoin("Aptos")) return unknown;
  if ((path[2] & 0x80000000) >>> 0 !== 0x80000000) return unknown;
  if ((path[3] & 0x80000000) >>> 0 !== 0x80000000) return unknown;
  if ((path[4] & 0x80000000) >>> 0 !== 0x80000000) return unknown;

  const index = path[2] & 0x7fffffff;
  return {
    verbose: `Aptos Account #${index}`,
    accountIdx: index,
    wholeAccount: true,
    coin: "Aptos",
    isKnown: true,
  };
}

// The standard derivation path for Aptos is: m/44'/637'/<account>'/0'/0'
// Aptos uses SLIP-0010 which requires all derivation to be hardened for Ed25519
export function aptosGetAccountPaths(msg: AptosGetAccountPaths): Array<AptosAccountPath> {
  const slip44 = core.slip44ByCoin("Aptos");
  return [
    {
      addressNList: [0x80000000 + 44, 0x80000000 + slip44, 0x80000000 + msg.accountIdx, 0x80000000 + 0, 0x80000000 + 0],
    },
  ];
}
