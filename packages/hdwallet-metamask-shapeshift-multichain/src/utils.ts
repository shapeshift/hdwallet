// Copypasta from chain-adapters
import { addressNListToBIP32, bip32ToAddressNList } from "@shapeshiftoss/hdwallet-core";
import type { BIP44Params } from "@shapeshiftoss/types";

export const toRootDerivationPath = (bip44Params: BIP44Params): string => {
  const { purpose, coinType, accountNumber } = bip44Params;
  if (typeof purpose === "undefined") throw new Error("toPath: bip44Params.purpose is required");
  if (typeof coinType === "undefined") throw new Error("toPath: bip44Params.coinType is required");
  if (typeof accountNumber === "undefined") throw new Error("toPath: bip44Params.accountNumber is required");
  return `m/${purpose}'/${coinType}'/${accountNumber}'`;
};

export const toPath = (bip44Params: BIP44Params): string => {
  const { purpose, coinType, accountNumber, isChange = false, index = 0 } = bip44Params;
  if (typeof purpose === "undefined") throw new Error("toPath: bip44Params.purpose is required");
  if (typeof coinType === "undefined") throw new Error("toPath: bip44Params.coinType is required");
  if (typeof accountNumber === "undefined") throw new Error("toPath: bip44Params.accountNumber is required");
  return `m/${purpose}'/${coinType}'/${accountNumber}'/${Number(isChange)}/${index}`;
};

export const fromPath = (path: string): BIP44Params => {
  const parts = path.split("/");
  const sliced = parts.slice(1); // discard the m/
  if (sliced.length !== 5) throw new Error(`fromPath: path only has ${sliced.length} parts`);
  const partsWithoutPrimes = sliced.map((part) => part.replace("'", "")); // discard harderning
  const [purpose, coinType, accountNumber, isChangeNumber, index] = partsWithoutPrimes.map(Number);
  const isChange = Boolean(isChangeNumber);
  return { purpose, coinType, accountNumber, isChange, index };
};

export const toAddressNList = (bip44Params: BIP44Params): number[] => {
  return bip32ToAddressNList(toPath(bip44Params));
};

export const fromAddressNList = (addressNList: number[]): BIP44Params => {
  return fromPath(addressNListToBIP32(addressNList));
};
