import * as core from "@shapeshiftoss/hdwallet-core";
import * as bitcoinMsg from "bitcoinjs-message";
import Base64 from "base64-js";

export const supportedCoins = ["testnet", "bitcoin", "bitcoinCash", "litecoin", "dash", "digiByte", "dogecoin"];

const segwitCoins = ["bitcoin", "digiByte", "litecoin", "bitcoinGold", "testnet"];

export async function btcSupportsCoin(coin: core.Coin): Promise<boolean> {
  return supportedCoins.includes(String(coin).toLowerCase());
}

export async function btcGetAddress(bitcoin: any): Promise<string | null> {
  if (!bitcoin) throw new Error("XDEFI Bitcoin Provider not found");

  if (!(bitcoin && bitcoin.request)) {
    return null;
  }

  return new Promise((res, rej) => {
    try {
      bitcoin.request(
        {
          method: "request_accounts",
        },
        (err: any, bitcoinAccounts: string[]) => {
          if (err) rej(err);
          res(bitcoinAccounts[0]);
        }
      );
    } catch (error) {
      console.error(error);
      rej(error);
    }
  });
}

export async function btcSignTx(msg: core.BTCSignTx, address: string, bitcoin: any): Promise<core.BTCSignedTx | null> {
  if (!bitcoin) throw new Error("XDEFI Bitcoin Provider not found");

  if (!(bitcoin && bitcoin.request)) {
    return null;
  }

  return new Promise((res, rej) => {
    try {
      bitcoin.request(
        {
          method: "sign_transaction",
          params: [{ msg, from: address }],
        },
        (err: any, result: core.BTCSignedTx) => {
          if (err) rej(err);
          res(result);
        }
      );
    } catch (error) {
      rej(error);
    }
  });
}

export async function btcSignMessage(
  msg: core.BTCSignMessage,
  address: string,
  bitcoin: any
): Promise<core.BTCSignedMessage | null> {
  if (!bitcoin) throw new Error("XDEFI Bitcoin Provider not found");

  if (!(bitcoin && bitcoin.request)) {
    return null;
  }

  return new Promise((res, rej) => {
    try {
      bitcoin.request(
        {
          method: "sign_transaction",
          params: [{ msg, from: address }],
        },
        (err: any, result: string) => {
          if (err) rej(err);
          res({
            address,
            signature: result,
          });
        }
      );
    } catch (error) {
      console.error(error);
      rej(error);
    }
  });
}

export async function btcVerifyMessage(msg: core.BTCVerifyMessage) {
  try {
    const signature = Base64.fromByteArray(core.fromHexString(msg.signature));
    return bitcoinMsg.verify(msg.message, msg.address, signature);
  } catch (error) {
    console.log(`Error ocurred while verifying signature: ${error}`);
    return false;
  }
}

export function btcGetAccountPaths(msg: core.BTCGetAccountPaths): Array<core.BTCAccountPath> {
  const slip44 = core.slip44ByCoin(msg.coin);
  if (slip44 === undefined) return [];
  const bip44 = core.legacyAccount(msg.coin, slip44, msg.accountIdx);
  const bip49 = core.segwitAccount(msg.coin, slip44, msg.accountIdx);
  const bip84 = core.segwitNativeAccount(msg.coin, slip44, msg.accountIdx);

  const coinPaths = {
    bitcoin: [bip44, bip49, bip84],
    bitcoincash: [bip44, bip49, bip84],
    dash: [bip44],
    digibyte: [bip44, bip49, bip84],
    dogecoin: [bip44],
    litecoin: [bip44, bip49, bip84],
    testnet: [bip44, bip49, bip84],
  } as Partial<Record<string, Array<core.BTCAccountPath>>>;

  let paths: Array<core.BTCAccountPath> = coinPaths[msg.coin.toLowerCase()] || [];

  if (msg.scriptType !== undefined) {
    paths = paths.filter((path) => {
      return path.scriptType === msg.scriptType;
    });
  }

  return paths;
}
export async function btcSupportsScriptType(coin: core.Coin, scriptType?: core.BTCInputScriptType): Promise<boolean> {
  const supported = {
    Bitcoin: [
      core.BTCInputScriptType.SpendAddress,
      core.BTCInputScriptType.SpendWitness,
      core.BTCInputScriptType.SpendP2SHWitness,
    ],
    BitcoinCash: [core.BTCInputScriptType.SpendAddress],
  } as Partial<Record<core.Coin, Array<core.BTCInputScriptType>>>;

  const scriptTypes = supported[coin];
  return !!scriptTypes && !!scriptType && scriptTypes.includes(scriptType);
}
