import * as bitcoin from "@shapeshiftoss/bitcoinjs-lib";
import * as core from "@shapeshiftoss/hdwallet-core";
import { BTCInputScriptType } from "@shapeshiftoss/hdwallet-core";

export type BtcAccount = {
  address: string;
  // Phantom supposedly supports more scriptTypes but in effect, doesn't (currently)
  // https://github.com/orgs/phantom/discussions/173
  addressType: BTCInputScriptType.SpendWitness;
  publicKey: string;
  purpose: "payment" | "ordinals";
};

const fromHexString = (hexString: string) => {
  const bytes = hexString.match(/.{1,2}/g);
  if (!bytes) throw new Error("Invalid hex string");

  return Uint8Array.from(bytes.map((byte) => parseInt(byte, 16)));
};

const getNetwork = (coin: string): bitcoin.networks.Network => {
  switch (coin.toLowerCase()) {
    case "bitcoin":
      return bitcoin.networks.bitcoin;
    default:
      throw new Error(`Unsupported coin: ${coin}`);
  }
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function bitcoinGetAddress(_msg: core.BTCGetAddress, provider: any): Promise<string> {
  const accounts = await provider.requestAccounts();
  const paymentAddress = accounts.find((account: BtcAccount) => account.purpose === "payment")?.address;

  return paymentAddress;
}

async function addInput(
  wallet: core.BTCWallet,
  psbt: bitcoin.Psbt,
  input: core.BTCSignTxInput,
  coin: string,
  network: bitcoin.networks.Network
): Promise<void> {
  const inputData: Omit<bitcoin.PsbtTxInput, "hash"> & {
    nonWitnessUtxo?: Buffer;
    witnessUtxo?: { script: Buffer; value: number };
    hash: string | Buffer;
  } = {
    nonWitnessUtxo: input.hex ? Buffer.from(input.hex, "hex") : undefined,
    hash: input.txid,
    index: input.vout,
  };

  if (input.sequence !== undefined) {
    inputData.sequence = input.sequence;
  }

  if (input.scriptType) {
    switch (input.scriptType) {
      // Phantom supposedly supports more scriptTypes but in effect, doesn't (currently)
      // https://github.com/orgs/phantom/discussions/173
      // case "p2pkh":
      // inputData.nonWitnessUtxo = Buffer.from(input.hex, "hex");
      // break;
      // case "p2sh-p2wpkh":
      case BTCInputScriptType.SpendWitness: {
        const inputAddress = await wallet.btcGetAddress({ addressNList: input.addressNList, coin, showDisplay: false });

        if (!inputAddress) throw new Error("Could not get address from wallet");

        inputData.witnessUtxo = {
          script: bitcoin.address.toOutputScript(inputAddress, network),
          value: parseInt(input.amount),
        };
        break;
      }
      default:
        throw new Error(`Unsupported script type: ${input.scriptType}`);
    }
  }

  psbt.addInput(inputData);
}

async function addOutput(
  wallet: core.BTCWallet,
  psbt: bitcoin.Psbt,
  output: core.BTCSignTxOutput,
  coin: string
): Promise<void> {
  if ("address" in output && output.address) {
    psbt.addOutput({
      address: output.address,
      value: parseInt(output.amount),
    });
  } else if ("addressNList" in output && output.addressNList) {
    const outputAddress = await wallet.btcGetAddress({ addressNList: output.addressNList, coin, showDisplay: false });

    if (!outputAddress) throw new Error("Could not get address from wallet");

    psbt.addOutput({
      address: outputAddress,
      value: parseInt(output.amount),
    });
  }
}

export async function bitcoinSignTx(
  wallet: core.BTCWallet,
  msg: core.BTCSignTx,
  provider: any
): Promise<core.BTCSignedTx | null> {
  if (!msg.inputs.length || !msg.outputs.length) {
    throw new Error("Invalid input: Empty inputs or outputs");
  }

  const network = getNetwork(msg.coin);

  const psbt = new bitcoin.Psbt({ network });

  psbt.setVersion(msg.version ?? 2);
  if (msg.locktime) {
    psbt.setLocktime(msg.locktime);
  }

  for (const input of msg.inputs) {
    await addInput(wallet, psbt, input, msg.coin, network);
  }

  for (const output of msg.outputs) {
    await addOutput(wallet, psbt, output, msg.coin);
  }

  if (msg.opReturnData) {
    const data = Buffer.from(msg.opReturnData, "utf-8");
    const embed = bitcoin.payments.embed({ data: [data] });
    psbt.addOutput({
      script: embed.output!,
      value: 0,
    });
  }

  const inputsToSign = await Promise.all(
    msg.inputs.map(async (input, index) => {
      const address = await wallet.btcGetAddress({
        addressNList: input.addressNList,
        coin: msg.coin,
        showDisplay: false,
      });

      return {
        address,
        signingIndexes: [index],
        sigHash: bitcoin.Transaction.SIGHASH_ALL,
      };
    })
  );

  const signedPsbtHex = await provider.signPSBT(fromHexString(psbt.toHex()), { inputsToSign });

  const signedPsbt = bitcoin.Psbt.fromHex(signedPsbtHex, { network });

  signedPsbt.finalizeAllInputs();
  const tx = signedPsbt.extractTransaction();

  const signatures = signedPsbt.data.inputs.map((input) =>
    input.partialSig ? input.partialSig[0].signature.toString("hex") : ""
  );

  return {
    signatures,
    serializedTx: tx.toHex(),
  };
}
