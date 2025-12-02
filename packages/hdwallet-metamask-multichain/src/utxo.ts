import * as core from "@shapeshiftoss/hdwallet-core";

const supportedCoins = ["Bitcoin", "BitcoinCash", "Litecoin", "Dogecoin"];

export function utxoSupportsCoin(coin: core.Coin): boolean {
  // FIXME: inspect the CoinTable to determine which coins are actually supported by the device.
  return supportedCoins.includes(coin);
}

export function utxoSupportsScriptType(coin: core.Coin, scriptType?: core.BTCScriptType): boolean {
  if (!utxoSupportsCoin(coin)) return false;

  switch (scriptType) {
    case core.BTCScriptType.LegacyMultisig:
    case core.BTCScriptType.Legacy:
    case core.BTCScriptType.SegwitNative:
    case core.BTCScriptType.Segwit:
      return true;
    default:
      return false;
  }
}

export function describeUTXOPath(
  path: core.BIP32Path,
  coin: core.Coin,
  scriptType?: core.BTCScriptType
): core.PathDescription {
  const unknown = core.unknownUTXOPath(path, coin, scriptType);

  if (!scriptType) return unknown;
  if (!utxoSupportsCoin(coin)) return unknown;
  if (!utxoSupportsScriptType(coin, scriptType)) return unknown;

  return core.describeUTXOPath(path, coin, scriptType);
}

export function utxoGetAccountPaths(msg: core.BTCGetAccountPaths): Array<core.BTCAccountPath> {
  const slip44 = core.slip44ByCoin(msg.coin);
  if (slip44 === undefined) return [];
  const bip44 = core.legacyAccount(msg.coin, slip44, msg.accountIdx);
  const bip49 = core.segwitAccount(msg.coin, slip44, msg.accountIdx);
  const bip84 = core.segwitNativeAccount(msg.coin, slip44, msg.accountIdx);

  // For BTC Forks
  const btcLegacy = core.legacyAccount(msg.coin, core.slip44ByCoin("Bitcoin"), msg.accountIdx);
  const btcSegwit = core.segwitAccount(msg.coin, core.slip44ByCoin("Bitcoin"), msg.accountIdx);
  const btcSegwitNative = core.segwitNativeAccount(msg.coin, core.slip44ByCoin("Bitcoin"), msg.accountIdx);

  // For BCH Forks
  const bchLegacy = core.legacyAccount(msg.coin, core.slip44ByCoin("BitcoinCash"), msg.accountIdx);

  let paths: Array<core.BTCAccountPath> =
    (
      {
        Bitcoin: [bip44, bip49, bip84],
        Litecoin: [bip44, bip49, bip84],
        Dash: [bip44],
        DigiByte: [bip44, bip49, bip84],
        Dogecoin: [bip44],
        Testnet: [bip44, bip49, bip84],
        BitcoinCash: [bip44, btcLegacy],
        BitcoinSV: [bip44, bchLegacy, btcLegacy],
        BitcoinGold: [bip44, bip49, bip84, btcLegacy, btcSegwit, btcSegwitNative],
      } as Partial<Record<core.Coin, core.BTCAccountPath[]>>
    )[msg.coin] ?? [];

  if (msg.scriptType !== undefined)
    paths = paths.filter((path) => {
      return path.scriptType === msg.scriptType;
    });

  return paths;
}
