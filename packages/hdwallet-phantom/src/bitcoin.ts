import ecc from "@bitcoinerlab/secp256k1";
import * as bitcoin from "@shapeshiftoss/bitcoinjs-lib";
import * as core from "@shapeshiftoss/hdwallet-core";
import { BTCInputScriptType } from "@shapeshiftoss/hdwallet-core";

import { PhantomUtxoProvider } from "./types";

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

export const btcGetAccountPaths = (msg: core.BTCGetAccountPaths): Array<core.BTCAccountPath> => {
  const slip44 = core.slip44ByCoin(msg.coin);
  if (slip44 === undefined) return [];

  const bip84 = core.segwitNativeAccount(msg.coin, slip44, msg.accountIdx);

  const coinPaths = {
    bitcoin: [bip84],
  } as Partial<Record<string, Array<core.BTCAccountPath>>>;

  let paths: Array<core.BTCAccountPath> = coinPaths[msg.coin.toLowerCase()] || [];

  if (msg.scriptType !== undefined) {
    paths = paths.filter((path) => {
      return path.scriptType === msg.scriptType;
    });
  }

  return paths;
};

export async function bitcoinGetAddress(_msg: core.BTCGetAddress, provider: any): Promise<string> {
  const accounts = await provider.requestAccounts();
  const paymentAddress = accounts.find((account: BtcAccount) => account.purpose === "payment")?.address;

  return paymentAddress;
}

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
  provider: PhantomUtxoProvider
): Promise<core.BTCSignedTx | null> {
  // instantiation of ecc lib required for taproot sends https://github.com/bitcoinjs/bitcoinjs-lib/issues/1889#issuecomment-1443792692
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

  const signedPsbtHex = await provider.signPSBT(fromHexString(psbt.toHex()), { inputsToSign });
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
}
