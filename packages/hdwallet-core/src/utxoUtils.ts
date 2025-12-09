import bs58check from "bs58check";

import { BTCInputScriptType } from "./bitcoin";

enum UtxoAccountType {
  SegwitNative = "SegwitNative",
  SegwitP2sh = "SegwitP2sh",
  P2pkh = "P2pkh",
}

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

  const payload = Buffer.from(bs58check.decode(xpub));
  const version = payload.subarray(0, 4);
  const desiredVersion = accountTypeToVersion(coin, accountType);

  if (version.compare(desiredVersion) !== 0) {
    // Get the key without the version code at the front
    const key = payload.subarray(4);

    return bs58check.encode(Buffer.concat([desiredVersion, key]));
  }

  return xpub;
}
