import { decode, encode } from "bs58check";

import { BTCInputScriptType, BTCOutputScriptType } from "./bitcoin";

export declare enum UtxoAccountType {
  SegwitNative = "SegwitNative",
  SegwitP2sh = "SegwitP2sh",
  P2pkh = "P2pkh",
}

/**
 * Utility function to convert a BTCInputScriptType to the corresponding BTCOutputScriptType
 */
export const toBtcOutputScriptType = (x: BTCInputScriptType) => {
  switch (x) {
    case BTCInputScriptType.SpendWitness:
      return BTCOutputScriptType.PayToWitness;
    case BTCInputScriptType.SpendP2SHWitness:
      return BTCOutputScriptType.PayToP2SHWitness;
    case BTCInputScriptType.SpendMultisig:
      return BTCOutputScriptType.PayToMultisig;
    case BTCInputScriptType.SpendAddress:
      return BTCOutputScriptType.PayToAddress;
    default:
      throw new TypeError("scriptType");
  }
};

export const accountTypeToScriptType: Record<UtxoAccountType, BTCInputScriptType> = Object.freeze({
  [UtxoAccountType.P2pkh]: BTCInputScriptType.SpendAddress,
  [UtxoAccountType.SegwitP2sh]: BTCInputScriptType.SpendP2SHWitness,
  [UtxoAccountType.SegwitNative]: BTCInputScriptType.SpendWitness,
});

export const accountTypeToOutputScriptType: Record<UtxoAccountType, BTCOutputScriptType> = Object.freeze({
  [UtxoAccountType.P2pkh]: BTCOutputScriptType.PayToAddress,
  [UtxoAccountType.SegwitP2sh]: BTCOutputScriptType.PayToP2SHWitness,
  [UtxoAccountType.SegwitNative]: BTCOutputScriptType.PayToWitness,
});

export const scriptTypeToAccountType: Record<BTCInputScriptType, UtxoAccountType | undefined> = Object.freeze({
  [BTCInputScriptType.SpendAddress]: UtxoAccountType.P2pkh,
  [BTCInputScriptType.SpendP2SHWitness]: UtxoAccountType.SegwitP2sh,
  [BTCInputScriptType.SpendWitness]: UtxoAccountType.SegwitNative,
  [BTCInputScriptType.SpendMultisig]: undefined,
  [BTCInputScriptType.Bech32]: undefined,
  [BTCInputScriptType.CashAddr]: undefined,
  [BTCInputScriptType.External]: undefined,
});

/**
 * BIP32 extended public key version bytes for different script types.
 */
enum PublicKeyType {
  xpub = "0488b21e",
  ypub = "049d7cb2",
  zpub = "04b24746",
  dgub = "02facafd",
  Ltub = "019da462",
  Mtub = "01b26ef6",
}

const accountTypeToVersion = (() => {
  const Litecoin = {
    [UtxoAccountType.P2pkh]: Buffer.from(PublicKeyType.Ltub, "hex"),
    [UtxoAccountType.SegwitP2sh]: Buffer.from(PublicKeyType.Mtub, "hex"),
    [UtxoAccountType.SegwitNative]: Buffer.from(PublicKeyType.zpub, "hex"),
  };

  const Dogecoin = {
    [UtxoAccountType.P2pkh]: Buffer.from(PublicKeyType.dgub, "hex"),
  };
  const Bitcoin = {
    [UtxoAccountType.P2pkh]: Buffer.from(PublicKeyType.xpub, "hex"),
    [UtxoAccountType.SegwitP2sh]: Buffer.from(PublicKeyType.ypub, "hex"),
    [UtxoAccountType.SegwitNative]: Buffer.from(PublicKeyType.zpub, "hex"),
  };

  return (coin: string, type: UtxoAccountType) => {
    switch (coin) {
      case "Litecoin":
        return Litecoin[type];
      case "Bitcoin":
        return Bitcoin[type];
      case "Dogecoin":
        if (type !== UtxoAccountType.P2pkh) throw new Error("Unsupported account type");
        return Dogecoin[type];
      default:
        return Bitcoin[type];
    }
  };
})();

const convertVersions = ["Ltub", "xpub", "dgub"];

/**
 * Convert xpub version bytes for different coins (e.g., xpub → dgub for Dogecoin)
 */
export function convertXpubVersion(xpub: string, accountType: UtxoAccountType | undefined, coin: string) {
  if (!accountType) return xpub;
  if (!convertVersions.includes(xpub.substring(0, 4))) return xpub;

  const payload = decode(xpub);
  const version = payload.subarray(0, 4);
  const desiredVersion = accountTypeToVersion(coin, accountType);

  if (version.compare(desiredVersion) !== 0) {
    // Get the key without the version code at the front
    const key = payload.subarray(4);

    return encode(Buffer.concat([desiredVersion, key]));
  }

  return xpub;
}
