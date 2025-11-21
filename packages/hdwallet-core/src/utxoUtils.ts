import { decode, encode } from "bs58check";

import { BTCScriptType } from "./bitcoin";

enum UtxoAccountType {
  SegwitNative = "SegwitNative",
  SegwitP2sh = "SegwitP2sh",
  P2pkh = "P2pkh",
}

export const scriptTypeToAccountType: Record<BTCScriptType, UtxoAccountType | undefined> = Object.freeze({
  [BTCScriptType.Legacy]: UtxoAccountType.P2pkh,
  [BTCScriptType.Segwit]: UtxoAccountType.SegwitP2sh,
  [BTCScriptType.SegwitNative]: UtxoAccountType.SegwitNative,
  [BTCScriptType.LegacyMultisig]: undefined,
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
