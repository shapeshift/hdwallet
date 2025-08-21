import * as core from "@shapeshiftoss/hdwallet-core";

import { VultisigUtxoProvider } from "./types";

interface VultisigBitcoinRequest {
  asset: {
    chain: string;
    ticker: string;
    symbol: string;
  };
  from: string;
  to: string;
  amount: {
    amount: string;
    decimals: number;
  };
  data: string;
  skipBroadcast?: boolean;
}

export function translateCoin(coin: core.Coin): string {
  return core.mustBeDefined(
    {
      Bitcoin: "btc",
      Litecoin: "ltc",
      Zcash: "zec",
      BitcoinCash: "bch",
      Dash: "dash",
      Dogecoin: "doge",
    }[coin]
  );
}

export type BtcAccount = string;

export const btcGetAccountPaths = (msg: core.BTCGetAccountPaths): Array<core.BTCAccountPath> => {
  const slip44 = core.slip44ByCoin(msg.coin);
  if (slip44 === undefined) return [];

  let scriptType: core.BTCInputScriptType;
  let purpose: number;

  switch (msg.coin) {
    case "Bitcoin":
    case "Litecoin":
      scriptType = core.BTCInputScriptType.SpendWitness; // BIP84
      purpose = 84;
      break;
    case "Dash":
    case "Dogecoin":
    case "BitcoinCash":
    case "Zcash":
      scriptType = core.BTCInputScriptType.SpendAddress; // BIP44
      purpose = 44;
      break;
    default:
      return [];
  }

  const addressNList = [0x80000000 + purpose, 0x80000000 + slip44, 0x80000000 + msg.accountIdx, 0, 0];

  const path: core.BTCAccountPath = {
    coin: msg.coin,
    scriptType,
    addressNList,
  };

  if (msg.scriptType !== undefined && path.scriptType !== msg.scriptType) {
    return [];
  }

  return [path];
};

export async function bitcoinSignTx(
  wallet: core.BTCWallet,
  msg: core.BTCSignTx,
  provider: VultisigUtxoProvider
): Promise<core.BTCSignedTx | null> {
  try {
    const coin = translateCoin(msg.coin);

    if (!coin) throw new Error("Unsupported coin");

    const fromAddress = await wallet.btcGetAddress({
      addressNList: msg.inputs[0].addressNList,
      coin: msg.coin,
      showDisplay: false,
    });

    if (!fromAddress) throw new Error("Could not get from address from wallet");

    const toOutput = msg.outputs.find((o) => !o.isChange);
    const toAddress =
      toOutput?.address ||
      (await wallet.btcGetAddress({
        addressNList: toOutput?.addressNList || msg.inputs[0].addressNList,
        coin: msg.coin,
        showDisplay: false,
      })) ||
      fromAddress;

    const totalAmount = msg.outputs
      .filter((o) => !o.isChange)
      .reduce((sum, o) => sum + BigInt(o.amount ?? 0), BigInt(0));

    const vultisigRequest: VultisigBitcoinRequest = {
      asset: {
        chain: coin,
        ticker: coin,
        symbol: coin,
      },
      from: fromAddress,
      to: toAddress || fromAddress,
      amount: {
        amount: totalAmount.toString(),
        decimals: 8,
      },
      data: msg.opReturnData || "",
      skipBroadcast: true,
    };

    const result = await provider.request({
      method: "send_transaction",
      params: [vultisigRequest],
    });

    const byteArray = Object.values(result.encoded) as any;

    const buffer = Buffer.from(byteArray);

    const serializedTx = buffer.toString("hex");

    return {
      signatures: [],
      serializedTx: serializedTx || "",
    };
  } catch (error) {
    console.error("Error signing with Vultisig:", error);
    return null;
  }
}
