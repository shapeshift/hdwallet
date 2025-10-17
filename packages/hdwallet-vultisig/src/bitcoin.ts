import * as bitcoin from "@shapeshiftoss/bitcoinjs-lib";
import * as core from "@shapeshiftoss/hdwallet-core";
import { BTCInputScriptType } from "@shapeshiftoss/hdwallet-core";

import { VultisigUtxoProvider } from "./types";

const getNetwork = (coin: string): bitcoin.networks.Network => {
  switch (coin.toLowerCase()) {
    case "bitcoin":
      return bitcoin.networks.bitcoin;
    default:
      throw new Error(`Unsupported coin: ${coin}`);
  }
};

export function translateCoin(coin: core.Coin): string {
  const coinMap: Record<core.Coin, string> = {
    Bitcoin: "btc",
    // Litecoin: "ltc",
    // Zcash: "zec",
    // BitcoinCash: "bch",
    // Dash: "dash",
    // Dogecoin: "doge",
  };
  return core.mustBeDefined(coinMap[coin]);
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
    // case "Dash":
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

const fromHexString = (hexString: string) => {
  const bytes = hexString.match(/.{1,2}/g);
  if (!bytes) throw new Error("Invalid hex string");

  return Uint8Array.from(bytes.map((byte) => parseInt(byte, 16)));
};

async function addInput(psbt: bitcoin.Psbt, input: core.BTCSignTxInput): Promise<void> {
  switch (input.scriptType) {
    // Phantom supposedly supports more scriptTypes but in effect, doesn't (currently)
    // https://github.com/orgs/phantom/discussions/173
    case BTCInputScriptType.SpendWitness: {
      psbt.addInput({
        hash: input.txid,
        index: input.vout,
        nonWitnessUtxo: Buffer.from(input.hex, "hex"),
      });

      break;
    }
    default:
      throw new Error(`Unsupported script type: ${input.scriptType}`);
  }
}

async function addOutput(
  wallet: core.BTCWallet,
  psbt: bitcoin.Psbt,
  output: core.BTCSignTxOutput,
  coin: string
): Promise<void> {
  if (!output.amount) throw new Error("Invalid output - missing amount.");

  const address = await (async () => {
    if (output.address) return output.address;

    if (output.addressNList) {
      const outputAddress = await wallet.btcGetAddress({ addressNList: output.addressNList, coin, showDisplay: false });
      if (!outputAddress) throw new Error("Could not get address from wallet");
      return outputAddress;
    }
  })();

  if (!address) throw new Error("Invalid output - no address");

  psbt.addOutput({ address, value: BigInt(output.amount) });
}

export async function bitcoinSignTx(
  wallet: core.BTCWallet,
  msg: core.BTCSignTx,
  provider: VultisigUtxoProvider
): Promise<core.BTCSignedTx | null> {
  try {
    const network = getNetwork(msg.coin);
    const psbt = new bitcoin.Psbt({ network });

    psbt.setVersion(msg.version ?? 2);
    if (msg.locktime) {
      psbt.setLocktime(msg.locktime);
    }

    for (const input of msg.inputs) {
      await addInput(psbt, input);
    }

    for (const output of msg.outputs) {
      await addOutput(wallet, psbt, output, msg.coin);
    }

    if (msg.opReturnData) {
      const data = Buffer.from(msg.opReturnData, "utf-8");
      const embed = bitcoin.payments.embed({ data: [data] });
      const script = embed.output;
      if (!script) throw new Error("unable to build OP_RETURN script");
      // OP_RETURN_DATA output is always 0 value
      psbt.addOutput({ script, value: BigInt(0) });
    }

    const inputsToSign = await Promise.all(
      msg.inputs.map(async (input, index) => {
        const address = await wallet.btcGetAddress({
          addressNList: input.addressNList,
          coin: msg.coin,
          showDisplay: false,
        });

        if (!address) throw new Error("Could not get address from wallet");

        return {
          address,
          signingIndexes: [index],
          sigHash: bitcoin.Transaction.SIGHASH_ALL,
        };
      })
    );

    const signedPsbtHex = await provider.signPSBT(fromHexString(psbt.toHex()), { inputsToSign }, false);
    const signedPsbt = bitcoin.Psbt.fromBuffer(Buffer.from(signedPsbtHex), { network });

    signedPsbt.finalizeAllInputs();

    const tx = signedPsbt.extractTransaction();

    // If this is a THORChain transaction, validate the vout ordering
    if (msg.vaultAddress && !core.validateVoutOrdering(msg, tx)) {
      throw new Error("Improper vout ordering for BTC Thorchain transaction");
    }

    const signatures = signedPsbt.data.inputs.map((input) =>
      input.partialSig ? Buffer.from(input.partialSig[0].signature).toString("hex") : ""
    );

    return {
      signatures,
      serializedTx: tx.toHex(),
    };
  } catch (error) {
    console.error("Error signing with Vultisig:", error);
    return null;
  }
}
