import { UtxoAccountType } from "@shapeshiftoss/types";
export { UtxoAccountType };

export enum PublicKeyType {
  xpub = "0488b21e",
  ypub = "049d7cb2",
  zpub = "04b24746",
  dgub = "02facafd",
  Ltub = "019da462",
  Mtub = "01b26ef6",
}

export const accountTypeToVersion = (() => {
  // const Litecoin = {
  //   [UtxoAccountType.P2pkh]: Buffer.from(PublicKeyType.Ltub, "hex"),
  //   [UtxoAccountType.SegwitP2sh]: Buffer.from(PublicKeyType.Mtub, "hex"),
  //   [UtxoAccountType.SegwitNative]: Buffer.from(PublicKeyType.zpub, "hex"),
  // };

  // const Dogecoin = {
  //   [UtxoAccountType.P2pkh]: Buffer.from(PublicKeyType.dgub, "hex"),
  // };

  const Bitcoin = {
    [UtxoAccountType.P2pkh]: Buffer.from(PublicKeyType.xpub, "hex"),
    [UtxoAccountType.SegwitP2sh]: Buffer.from(PublicKeyType.ypub, "hex"),
    [UtxoAccountType.SegwitNative]: Buffer.from(PublicKeyType.zpub, "hex"),
  };

  return (coin: string, type: UtxoAccountType) => {
    switch (coin) {
      // case "Litecoin":
      //   return Litecoin[type];
      case "Bitcoin":
        return Bitcoin[type];
      // case "Dogecoin":
      //   if (type !== UtxoAccountType.P2pkh) throw new Error("Unsupported account type");
      //   return Dogecoin[type];
      default:
        return Bitcoin[type];
    }
  };
})();

export const convertVersions = ["Ltub", "xpub", "dgub"];

export const UTXO_NETWORK_PARAMS: Record<string, { pubKeyHash: number; scriptHash: number; bech32?: string }> = {
  Bitcoin: { pubKeyHash: 0x00, scriptHash: 0x05, bech32: "bc" },
  // Dogecoin: { pubKeyHash: 0x1e, scriptHash: 0x16 },
  // Litecoin: { pubKeyHash: 0x30, scriptHash: 0x32, bech32: "ltc" },
  // BitcoinCash: { pubKeyHash: 0x00, scriptHash: 0x05 },
};
