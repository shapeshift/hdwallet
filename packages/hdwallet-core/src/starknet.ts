import { addressNListToBIP32, slip44ByCoin } from "./utils";
import { BIP32Path, HDWallet, HDWalletInfo, PathDescription } from "./wallet";

export interface StarknetGetAddress {
  addressNList: BIP32Path;
  showDisplay?: boolean;
}

export interface StarknetGetPublicKey {
  addressNList: BIP32Path;
}

export interface StarknetSignTx {
  addressNList: BIP32Path;
  txHash: string;
}

export interface StarknetSignedTx {
  signature: string[];
}

export interface StarknetGetAccountPaths {
  accountIdx: number;
}

export interface StarknetAccountPath {
  addressNList: BIP32Path;
}

export interface StarknetWalletInfo extends HDWalletInfo {
  readonly _supportsStarknetInfo: boolean;

  starknetGetAccountPaths(msg: StarknetGetAccountPaths): Array<StarknetAccountPath>;
  starknetNextAccountPath(msg: StarknetAccountPath): StarknetAccountPath | undefined;
}

export interface StarknetWallet extends StarknetWalletInfo, HDWallet {
  readonly _supportsStarknet: boolean;

  starknetGetAddress(msg: StarknetGetAddress): Promise<string | null>;
  starknetGetPublicKey(msg: StarknetGetPublicKey): Promise<string | null>;
  starknetSignTx(msg: StarknetSignTx): Promise<StarknetSignedTx | null>;
}

export function starknetDescribePath(path: BIP32Path): PathDescription {
  const pathStr = addressNListToBIP32(path);
  const unknown: PathDescription = {
    verbose: pathStr,
    coin: "Starknet",
    isKnown: false,
  };

  if (path.length != 5) return unknown;
  if (path[0] != 0x80000000 + 44) return unknown;
  if (path[1] != 0x80000000 + slip44ByCoin("Starknet")) return unknown;
  if ((path[2] & 0x80000000) >>> 0 !== 0x80000000) return unknown;
  if (path[3] !== 0) return unknown;
  if (path[4] !== 0) return unknown;

  const index = path[2] & 0x7fffffff;
  return {
    verbose: `Starknet Account #${index}`,
    accountIdx: index,
    wholeAccount: true,
    coin: "Starknet",
    isKnown: true,
  };
}

export function starknetGetAccountPaths(msg: StarknetGetAccountPaths): Array<StarknetAccountPath> {
  const slip44 = slip44ByCoin("Starknet");
  return [{ addressNList: [0x80000000 + 44, 0x80000000 + slip44, 0x80000000 + msg.accountIdx, 0, 0] }];
}
