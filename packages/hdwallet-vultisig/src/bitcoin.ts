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

  const coinPaths = {
    Bitcoin: [
      {
        coin: msg.coin,
        scriptType: core.BTCInputScriptType.SpendWitness, // BIP84: m/84'/0'/0'/0/0
        addressNList: [0x80000000 + 84, 0x80000000 + 0, 0x80000000 + msg.accountIdx, 0, 0],
      },
    ],
    Litecoin: [
      {
        coin: msg.coin,
        scriptType: core.BTCInputScriptType.SpendWitness, // BIP84: m/84'/2'/0'/0/0
        addressNList: [0x80000000 + 84, 0x80000000 + 2, 0x80000000 + msg.accountIdx, 0, 0],
      },
    ],
    Dash: [
      {
        coin: msg.coin,
        scriptType: core.BTCInputScriptType.SpendAddress, // BIP44: m/44'/5'/0'/0/0
        addressNList: [0x80000000 + 44, 0x80000000 + 5, 0x80000000 + msg.accountIdx, 0, 0],
      },
    ],
    Dogecoin: [
      {
        coin: msg.coin,
        scriptType: core.BTCInputScriptType.SpendAddress, // BIP44: m/44'/3'/0'/0/0
        addressNList: [0x80000000 + 44, 0x80000000 + 3, 0x80000000 + msg.accountIdx, 0, 0],
      },
    ],
    BitcoinCash: [
      {
        coin: msg.coin,
        scriptType: core.BTCInputScriptType.SpendAddress, // BIP44: m/44'/145'/0'/0/0
        addressNList: [0x80000000 + 44, 0x80000000 + 145, 0x80000000 + msg.accountIdx, 0, 0],
      },
    ],
    Zcash: [
      {
        coin: msg.coin,
        scriptType: core.BTCInputScriptType.SpendAddress, // BIP44: m/44'/133'/0'/0/0
        addressNList: [0x80000000 + 44, 0x80000000 + 133, 0x80000000 + msg.accountIdx, 0, 0],
      },
    ],
  } as Partial<Record<string, Array<core.BTCAccountPath>>>;

  let paths: Array<core.BTCAccountPath> = coinPaths[msg.coin] || [];

  if (msg.scriptType !== undefined) {
    paths = paths.filter((path) => {
      return path.scriptType === msg.scriptType;
    });
  }

  return paths;
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

    // TODO: hippo: Invalid logic does not substract own address (it's a work around for now)
    const toOutput = msg.outputs.find((o) => !o.isChange);
    const toAddress =
      toOutput?.address ||
      (await wallet.btcGetAddress({
        addressNList: toOutput?.addressNList || msg.inputs[0].addressNList,
        coin: msg.coin,
        showDisplay: false,
      })) ||
      fromAddress;

    const totalAmount = msg.outputs.reduce((sum, o) => sum + BigInt(o.amount ?? 0), BigInt(0));

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
