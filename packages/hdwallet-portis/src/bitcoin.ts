import {
  PathDescription,
  addressNListToBIP32,
  BIP32Path,
  slip44ByCoin,
  Coin,
  BTCInputScriptType,
  BTCGetAddress,
  BTCAccountPath,
  BTCGetAccountPaths,
  BTCSignTx,
  BTCSignedTx,
  BTCVerifyMessage,
  fromHexString,
  hardenedPath,
  relativePath,
} from "@shapeshiftoss/hdwallet-core";

import { verify } from "bitcoinjs-message";
import Base64 from "base64-js";
import { payments } from "bitcoinjs-lib";
import { fromBase58 } from "bip32";

export function describeUTXOPath(path: BIP32Path, coin: Coin, scriptType: BTCInputScriptType): PathDescription {
  let pathStr = addressNListToBIP32(path);
  let unknown: PathDescription = {
    verbose: pathStr,
    coin,
    scriptType,
    isKnown: false,
  };

  if (path.length !== 3 && path.length !== 5) return unknown;

  if ((path[0] & 0x80000000) >>> 0 !== 0x80000000) return unknown;

  let purpose = path[0] & 0x7fffffff;

  if (![44, 49, 84].includes(purpose)) return unknown;

  if (purpose === 44 && scriptType !== BTCInputScriptType.SpendAddress) return unknown;

  if (purpose === 49 && scriptType !== BTCInputScriptType.SpendP2SHWitness) return unknown;

  if (purpose === 84 && scriptType !== BTCInputScriptType.SpendWitness) return unknown;

  let wholeAccount = path.length === 3;

  let script = {
    [BTCInputScriptType.SpendAddress]: ["Legacy"],
    [BTCInputScriptType.SpendP2SHWitness]: [],
    [BTCInputScriptType.SpendWitness]: ["Segwit Native"],
  }[scriptType];

  let isPrefork = false;
  if (path[1] !== 0x80000000 + slip44ByCoin(coin)) {
    switch (coin) {
      case "BitcoinCash":
      case "BitcoinGold": {
        if (path[1] === 0x80000000 + slip44ByCoin("Bitcoin")) {
          isPrefork = true;
          break;
        }
        return unknown;
      }
      case "BitcoinSV": {
        if (path[1] === 0x80000000 + slip44ByCoin("Bitcoin") || path[1] === 0x80000000 + slip44ByCoin("BitcoinCash")) {
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

  let attr = attributes.length ? ` (${attributes.join(", ")})` : "";

  let accountIdx = path[2] & 0x7fffffff;

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
    let change = path[3] === 1 ? "Change " : "";
    let addressIdx = path[4];
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

export async function btcGetAddress(msg: BTCGetAddress, portis: any): Promise<string> {
  if (!msg.addressNList.length) throw new Error("Empty addressNList");

  const scriptType = msg.scriptType;
  const purpose = msg.addressNList[0];

  const hardPath = hardenedPath(msg.addressNList);
  const hardPathString = addressNListToBIP32(hardPath);

  const { result: xpub } = await portis.getExtendedPublicKey(hardPathString, "Bitcoin");

  const relPath = relativePath(msg.addressNList);
  const relPathString = addressNListToBIP32(relPath).substr(2);

  const args = { pubkey: fromBase58(xpub).derivePath(relPathString).publicKey };

  let result;
  switch (scriptType) {
    case BTCInputScriptType.SpendAddress:
      result = payments.p2pkh(args);
      break;
    case BTCInputScriptType.SpendWitness:
      result = payments.p2wpkh(args);
      break;
    case BTCInputScriptType.SpendP2SHWitness:
      result = payments.p2sh({
        redeem: payments.p2wpkh(args),
      });
      break;
    default:
      throw new Error(`Unsupported scriptType ${scriptType}`);
  }

  if (msg.showDisplay === true) {
    if (!verifyScriptTypePurpose(scriptType, purpose)) {
      throw new Error(`Invalid scriptType ${scriptType} for purpose ${purpose}`);
    }

    portis.showBitcoinWallet(addressNListToBIP32(msg.addressNList));
  }

  return result.address;
}

export function verifyScriptTypePurpose(scriptType: BTCInputScriptType, purpose: number): boolean {
  return (
    (purpose === 0x80000000 + 44 && scriptType === BTCInputScriptType.SpendAddress) ||
    (purpose === 0x80000000 + 49 && scriptType === BTCInputScriptType.SpendP2SHWitness) ||
    (purpose === 0x80000000 + 84 && scriptType === BTCInputScriptType.SpendWitness)
  );
}

export function legacyAccount(coin: Coin, slip44: number, accountIdx: number): BTCAccountPath {
  return {
    coin,
    scriptType: BTCInputScriptType.SpendAddress,
    addressNList: [0x80000000 + 44, 0x80000000 + slip44, 0x80000000 + accountIdx],
  };
}

export function segwitAccount(coin: Coin, slip44: number, accountIdx: number): BTCAccountPath {
  return {
    coin,
    scriptType: BTCInputScriptType.SpendP2SHWitness,
    addressNList: [0x80000000 + 49, 0x80000000 + slip44, 0x80000000 + accountIdx],
  };
}

export function segwitNativeAccount(coin: Coin, slip44: number, accountIdx: number): BTCAccountPath {
  return {
    coin,
    scriptType: BTCInputScriptType.SpendWitness,
    addressNList: [0x80000000 + 84, 0x80000000 + slip44, 0x80000000 + accountIdx],
  };
}

export function btcNextAccountPath(msg: BTCAccountPath): BTCAccountPath | undefined {
  return undefined;
}

export function btcGetAccountPaths(msg: BTCGetAccountPaths): Array<BTCAccountPath> {
  const slip44 = slip44ByCoin(msg.coin);
  const bip44 = legacyAccount(msg.coin, slip44, msg.accountIdx);
  const bip49 = segwitAccount(msg.coin, slip44, msg.accountIdx);
  const bip84 = segwitNativeAccount(msg.coin, slip44, msg.accountIdx);

  let paths: Array<BTCAccountPath> =
    {
      Bitcoin: [bip44, bip49, bip84],
    }[msg.coin] || [];

  if (msg.scriptType !== undefined)
    paths = paths.filter((path) => {
      return path.scriptType === msg.scriptType;
    });

  return paths;
}

export async function btcSupportsScriptType(coin: Coin, scriptType: BTCInputScriptType): Promise<boolean> {
  if (coin !== "Bitcoin") return Promise.resolve(false);

  switch (scriptType) {
    case BTCInputScriptType.SpendAddress:
    case BTCInputScriptType.SpendWitness:
    case BTCInputScriptType.SpendP2SHWitness:
      return true;
    default:
      return false;
  }
}

export async function btcSupportsCoin(coin: Coin): Promise<boolean> {
  if (coin === "Bitcoin") return true;
  else return false;
}

export async function btcSignTx(msg: BTCSignTx, portis: any): Promise<BTCSignedTx> {
  const { result } = await portis.signBitcoinTransaction(msg);
  return {
    signatures: ["signature1", "signature2", "signature3"],
    serializedTx: result.serializedTx,
  };
}

export async function btcVerifyMessage(msg: BTCVerifyMessage): Promise<boolean> {
  const signature = Base64.fromByteArray(fromHexString(msg.signature));
  return verify(msg.message, msg.address, signature);
}
