import * as core from "@shapeshiftoss/hdwallet-core";
import Base64 from "base64-js";
import * as bip32 from "bip32";
import * as bitcoin from "bitcoinjs-lib";
import * as bitcoinMsg from "bitcoinjs-message";

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
      )[scriptType] ?? ([] as string[])
    : ([] as string[]);

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

export function verifyScriptTypePurpose(scriptType: core.BTCInputScriptType, purpose: number): boolean {
  return (
    (purpose === 0x80000000 + 44 && scriptType === core.BTCInputScriptType.SpendAddress) ||
    (purpose === 0x80000000 + 49 && scriptType === core.BTCInputScriptType.SpendP2SHWitness) ||
    (purpose === 0x80000000 + 84 && scriptType === core.BTCInputScriptType.SpendWitness)
  );
}

export async function btcGetAddress(msg: core.BTCGetAddress, portis: any): Promise<string> {
  if (!msg.addressNList.length) throw new Error("Empty addressNList");

  const scriptType = msg.scriptType;
  const purpose = msg.addressNList[0];

  const hardPath = core.hardenedPath(msg.addressNList);
  const hardPathString = core.addressNListToBIP32(hardPath);

  const { result: xpub } = await portis.getExtendedPublicKey(hardPathString, "Bitcoin");

  const relPath = core.relativePath(msg.addressNList);
  const relPathString = core.addressNListToBIP32(relPath).substr(2);

  const args = { pubkey: bip32.fromBase58(xpub).derivePath(relPathString).publicKey };

  let result: bitcoin.payments.Payment;
  switch (scriptType) {
    case core.BTCInputScriptType.SpendAddress:
      result = bitcoin.payments.p2pkh(args);
      break;
    case core.BTCInputScriptType.SpendWitness:
      result = bitcoin.payments.p2wpkh(args);
      break;
    case core.BTCInputScriptType.SpendP2SHWitness:
      result = bitcoin.payments.p2sh({
        redeem: bitcoin.payments.p2wpkh(args),
      });
      break;
    default:
      throw new Error(`Unsupported scriptType ${scriptType}`);
  }

  if (msg.showDisplay === true) {
    if (!verifyScriptTypePurpose(scriptType, purpose)) {
      throw new Error(`Invalid scriptType ${scriptType} for purpose ${purpose}`);
    }

    portis.showBitcoinWallet(core.addressNListToBIP32(msg.addressNList));
  }

  return core.mustBeDefined(result.address);
}

export function legacyAccount(coin: core.Coin, slip44: number, accountIdx: number): core.BTCAccountPath {
  return {
    coin,
    scriptType: core.BTCInputScriptType.SpendAddress,
    addressNList: [0x80000000 + 44, 0x80000000 + slip44, 0x80000000 + accountIdx],
  };
}

export function segwitAccount(coin: core.Coin, slip44: number, accountIdx: number): core.BTCAccountPath {
  return {
    coin,
    scriptType: core.BTCInputScriptType.SpendP2SHWitness,
    addressNList: [0x80000000 + 49, 0x80000000 + slip44, 0x80000000 + accountIdx],
  };
}

export function segwitNativeAccount(coin: core.Coin, slip44: number, accountIdx: number): core.BTCAccountPath {
  return {
    coin,
    scriptType: core.BTCInputScriptType.SpendWitness,
    addressNList: [0x80000000 + 84, 0x80000000 + slip44, 0x80000000 + accountIdx],
  };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function btcNextAccountPath(msg: core.BTCAccountPath): core.BTCAccountPath | undefined {
  return undefined;
}

export function btcGetAccountPaths(msg: core.BTCGetAccountPaths): Array<core.BTCAccountPath> {
  const slip44 = core.slip44ByCoin(msg.coin);
  if (slip44 == undefined) return [];
  const bip44 = legacyAccount(msg.coin, slip44, msg.accountIdx);
  const bip49 = segwitAccount(msg.coin, slip44, msg.accountIdx);
  const bip84 = segwitNativeAccount(msg.coin, slip44, msg.accountIdx);

  let paths: Array<core.BTCAccountPath> =
    (
      {
        Bitcoin: [bip44, bip49, bip84],
      } as Partial<Record<core.Coin, core.BTCAccountPath[]>>
    )[msg.coin] || [];

  if (msg.scriptType !== undefined)
    paths = paths.filter((path) => {
      return path.scriptType === msg.scriptType;
    });

  return paths;
}

export async function btcSupportsScriptType(coin: core.Coin, scriptType?: core.BTCInputScriptType): Promise<boolean> {
  if (coin !== "Bitcoin") return Promise.resolve(false);

  switch (scriptType) {
    case core.BTCInputScriptType.SpendAddress:
    case core.BTCInputScriptType.SpendWitness:
    case core.BTCInputScriptType.SpendP2SHWitness:
      return true;
    default:
      return false;
  }
}

export async function btcSupportsCoin(coin: core.Coin): Promise<boolean> {
  if (coin === "Bitcoin") return true;
  else return false;
}

export async function btcSignTx(msg: core.BTCSignTx, portis: any): Promise<core.BTCSignedTx> {
  const { result } = await portis.signBitcoinTransaction(msg);
  return {
    // TODO: parse signatures out of serializedTx
    signatures: core.untouchable("not implemented"),
    serializedTx: result.serializedTx,
  };
}

export async function btcVerifyMessage(msg: core.BTCVerifyMessage): Promise<boolean> {
  const signature = Base64.fromByteArray(core.fromHexString(msg.signature));
  return bitcoinMsg.verify(msg.message, msg.address, signature);
}
