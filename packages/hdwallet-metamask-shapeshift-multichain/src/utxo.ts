import * as core from "@shapeshiftoss/hdwallet-core";

const supportedCoins = ["Bitcoin", "BitcoinCash", "Litecoin", "Dogecoin"];

function legacyAccount(coin: core.Coin, slip44: number, accountIdx: number): core.BTCAccountPath {
  return {
    coin,
    scriptType: core.BTCInputScriptType.SpendAddress,
    addressNList: [0x80000000 + 44, 0x80000000 + slip44, 0x80000000 + accountIdx],
  };
}

function segwitAccount(coin: core.Coin, slip44: number, accountIdx: number): core.BTCAccountPath {
  return {
    coin,
    scriptType: core.BTCInputScriptType.SpendP2SHWitness,
    addressNList: [0x80000000 + 49, 0x80000000 + slip44, 0x80000000 + accountIdx],
  };
}

function segwitNativeAccount(coin: core.Coin, slip44: number, accountIdx: number): core.BTCAccountPath {
  return {
    coin,
    scriptType: core.BTCInputScriptType.SpendWitness,
    addressNList: [0x80000000 + 84, 0x80000000 + slip44, 0x80000000 + accountIdx],
  };
}

export function utxoSupportsCoin(coin: core.Coin): boolean {
  // FIXME: inspect the CoinTable to determine which coins are actually supported by the device.
  return supportedCoins.includes(coin);
}

export function utxoSupportsScriptType(coin: core.Coin, scriptType?: core.BTCInputScriptType): boolean {
  if (!utxoSupportsCoin(coin)) return false;

  switch (scriptType) {
    case core.BTCInputScriptType.SpendMultisig:
    case core.BTCInputScriptType.SpendAddress:
    case core.BTCInputScriptType.SpendWitness:
    case core.BTCInputScriptType.Bech32:
    case core.BTCInputScriptType.SpendP2SHWitness:
      return true;
    default:
      return false;
  }
}

export function describeUTXOPath(
  path: core.BIP32Path,
  coin: core.Coin,
  scriptType?: core.BTCInputScriptType
): core.PathDescription {
  const pathStr = core.addressNListToBIP32(path);
  const unknown: core.PathDescription = {
    verbose: pathStr,
    coin,
    scriptType,
    isKnown: false,
  };
  if (!scriptType) return unknown;

  if (!utxoSupportsCoin(coin)) return unknown;

  if (!utxoSupportsScriptType(coin, scriptType)) return unknown;

  if (path.length !== 3 && path.length !== 5) return unknown;

  if ((path[0] & 0x80000000) >>> 0 !== 0x80000000) return unknown;

  const purpose = path[0] & 0x7fffffff;

  if (![44, 49, 84].includes(purpose)) return unknown;

  if (purpose === 44 && scriptType !== core.BTCInputScriptType.SpendAddress) return unknown;

  if (purpose === 49 && scriptType !== core.BTCInputScriptType.SpendP2SHWitness) return unknown;

  if (purpose === 84 && scriptType !== core.BTCInputScriptType.SpendWitness) return unknown;

  const wholeAccount = path.length === 3;

  const script = scriptType
    ? (
        {
          [core.BTCInputScriptType.SpendAddress]: ["Legacy"],
          [core.BTCInputScriptType.SpendP2SHWitness]: [],
          [core.BTCInputScriptType.SpendWitness]: ["Segwit Native"],
        } as Partial<Record<core.BTCInputScriptType, string[]>>
      )[scriptType] ?? []
    : [];

  let isPrefork = false;
  const slip44 = core.slip44ByCoin(coin);
  if (slip44 === undefined) return unknown;
  if (path[1] !== 0x80000000 + slip44) {
    switch (coin) {
      case "BitcoinCash":
      case "BitcoinGold": {
        if (path[1] === 0x80000000 + core.slip44ByCoin("Bitcoin")) {
          isPrefork = true;
          break;
        }
        return unknown;
      }
      case "BitcoinSV": {
        if (
          path[1] === 0x80000000 + core.slip44ByCoin("Bitcoin") ||
          path[1] === 0x80000000 + core.slip44ByCoin("BitcoinCash")
        ) {
          isPrefork = true;
          break;
        }
        return unknown;
      }
      default:
        return unknown;
    }
  }

  let attributes = isPrefork ? ["Prefork"] : [];
  switch (coin) {
    case "Bitcoin":
    case "Litecoin":
    case "BitcoinGold":
    case "Testnet": {
      attributes = attributes.concat(script);
      break;
    }
    default:
      break;
  }

  const attr = attributes.length ? ` (${attributes.join(", ")})` : "";

  const accountIdx = path[2] & 0x7fffffff;

  if (wholeAccount) {
    return {
      coin,
      verbose: `${coin} Account #${accountIdx}${attr}`,
      accountIdx,
      wholeAccount: true,
      isKnown: true,
      scriptType,
      isPrefork,
    };
  } else {
    const change = path[3] === 1 ? "Change " : "";
    const addressIdx = path[4];
    return {
      coin,
      verbose: `${coin} Account #${accountIdx}, ${change}Address #${addressIdx}${attr}`,
      accountIdx,
      addressIdx,
      wholeAccount: false,
      isKnown: true,
      isChange: path[3] === 1,
      scriptType,
      isPrefork,
    };
  }
}

export function utxoGetAccountPaths(msg: core.BTCGetAccountPaths): Array<core.BTCAccountPath> {
  const slip44 = core.slip44ByCoin(msg.coin);
  if (slip44 === undefined) return [];
  const bip44 = legacyAccount(msg.coin, slip44, msg.accountIdx);
  const bip49 = segwitAccount(msg.coin, slip44, msg.accountIdx);
  const bip84 = segwitNativeAccount(msg.coin, slip44, msg.accountIdx);

  // For BTC Forks
  const btcLegacy = legacyAccount(msg.coin, core.slip44ByCoin("Bitcoin"), msg.accountIdx);
  const btcSegwit = segwitAccount(msg.coin, core.slip44ByCoin("Bitcoin"), msg.accountIdx);
  const btcSegwitNative = segwitNativeAccount(msg.coin, core.slip44ByCoin("Bitcoin"), msg.accountIdx);

  // For BCH Forks
  const bchLegacy = legacyAccount(msg.coin, core.slip44ByCoin("BitcoinCash"), msg.accountIdx);

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
