import ecc from "@bitcoinerlab/secp256k1";
import * as bitcoin from "@shapeshiftoss/bitcoinjs-lib";
import * as core from "@shapeshiftoss/hdwallet-core";
import { BTCInputScriptType } from "@shapeshiftoss/hdwallet-core";

import { VultisigUtxoProvider } from "./types";

const dogecoinNetwork: bitcoin.networks.Network = {
  messagePrefix: '\x19Dogecoin Signed Message:\n',
  bech32: 'doge',
  bip32: { public: 0x02facafd, private: 0x02fac398 },
  pubKeyHash: 0x1e,
  scriptHash: 0x16,
  wif: 0x9e,
};

const getNetwork = (coin: string): bitcoin.networks.Network => {
  switch (coin.toLowerCase()) {
    case "bitcoin":
      return bitcoin.networks.bitcoin;
    case "dogecoin":
      return dogecoinNetwork;
    default:
      throw new Error(`Unsupported coin: ${coin}`);
  }
};

export async function btcGetAddress(provider: VultisigUtxoProvider, msg: core.BTCGetAddress): Promise<string | null> {
  const value = await (async () => {
    switch (msg.coin.toLowerCase()) {
      case "bitcoin":
      case "dogecoin": {
        const accounts = await provider.request<"request_accounts">({
          method: "request_accounts",
          params: [],
        });
        return accounts.length > 0 ? accounts[0] : null;
      }
      default:
        throw new Error("Vultisig does not support");
    }
  })();
  if (!value || typeof value !== "string") return null;

  return value;
}

export const btcGetAccountPaths = (msg: core.BTCGetAccountPaths): Array<core.BTCAccountPath> => {
  const slip44 = core.slip44ByCoin(msg.coin);
  if (slip44 === undefined) return [];

  const bip84 = core.segwitNativeAccount(msg.coin, slip44, msg.accountIdx);
  const bip44 = core.legacyAccount(msg.coin, slip44, msg.accountIdx);

  const coinPaths = {
    bitcoin: [bip84],
    dogecoin: [bip44],
  } as Partial<Record<string, Array<core.BTCAccountPath>>>;

  let paths: Array<core.BTCAccountPath> = coinPaths[msg.coin.toLowerCase()] || [];

  if (msg.scriptType !== undefined) {
    paths = paths.filter((path) => {
      return path.scriptType === msg.scriptType;
    });
  }

  return paths;
};

async function addInput(psbt: bitcoin.Psbt, input: core.BTCSignTxInput): Promise<void> {
  switch (input.scriptType) {
    case BTCInputScriptType.SpendWitness: {
      psbt.addInput({
        hash: input.txid,
        index: input.vout,
        nonWitnessUtxo: Buffer.from(input.hex, "hex"),
      });
      break;
    }
    case BTCInputScriptType.SpendAddress: {
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
  provider: VultisigUtxoProvider,
  psbt: bitcoin.Psbt,
  output: core.BTCSignTxOutput,
  coin: string
): Promise<void> {
  if (!output.amount) throw new Error("Invalid output - missing amount.");

  const address = await (async () => {
    if (output.address) return output.address;

    if (output.addressNList) {
      const outputAddress = await btcGetAddress(provider, {
        addressNList: output.addressNList,
        coin,
        showDisplay: false,
      });
      if (!outputAddress) throw new Error("Could not get address from wallet");
      return outputAddress;
    }
  })();

  if (!address) throw new Error("Invalid output - no address");

  psbt.addOutput({ address, value: BigInt(output.amount) });
}

export async function bitcoinSignTx(
  msg: core.BTCSignTx,
  provider: VultisigUtxoProvider
): Promise<core.BTCSignedTx | null> {
  try {
    // Instantiation of ecc lib required for proper PSBT operations
    bitcoin.initEccLib(ecc);

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
      await addOutput(provider, psbt, output, msg.coin);
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
        const address = await btcGetAddress(provider, {
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

    const psbtBuffer = psbt.toBuffer();
    console.log('[VULTISIG PSBT DEBUG]', {
      coin: msg.coin,
      network: network,
      psbtBase64: Buffer.from(psbtBuffer).toString('base64'),
      psbtHex: Buffer.from(psbtBuffer).toString('hex'),
      inputsToSign,
      inputCount: msg.inputs.length,
      outputCount: msg.outputs.length,
    });

    const signedPsbtBuffer = await provider.signPSBT(psbtBuffer, { inputsToSign }, false);
    console.log('[VULTISIG PSBT DEBUG] Signed PSBT returned:', {
      coin: msg.coin,
      signedLength: signedPsbtBuffer?.length,
      signedBase64: signedPsbtBuffer ? Buffer.from(signedPsbtBuffer).toString('base64').substring(0, 100) + '...' : null,
    });

    const signedPsbt = bitcoin.Psbt.fromBuffer(signedPsbtBuffer, { network });

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
