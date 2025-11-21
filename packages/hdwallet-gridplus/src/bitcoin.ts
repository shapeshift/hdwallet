import * as bitcoin from "@shapeshiftoss/bitcoinjs-lib";
import * as core from "@shapeshiftoss/hdwallet-core";
import { toCashAddress, toLegacyAddress } from "bchaddrjs";
import { Client, Constants } from "gridplus-sdk";

import { getCompressedPubkey } from "./utils";

export function deriveAddressFromPubkey(
  pubkey: Buffer,
  coin: string,
  scriptType: core.BTCScriptType
): string | undefined {
  const network = core.getNetwork(coin, scriptType);
  return core.createPayment(pubkey, network, scriptType).address;
}

const getPublicKey = async (client: Client, addressNList: core.BIP32Path): Promise<Buffer> => {
  const pubkey = (
    await client.getAddresses({ startPath: addressNList, n: 1, flag: Constants.GET_ADDR_FLAGS.SECP256K1_PUB })
  )[0];

  if (!pubkey) throw new Error("No public key returned from device");
  if (!Buffer.isBuffer(pubkey)) throw new Error("Invalid public key returned from device");

  return getCompressedPubkey(pubkey);
};

export async function btcGetAddress(client: Client, msg: core.BTCGetAddress): Promise<string | null> {
  const pubkey = await getPublicKey(client, msg.addressNList);

  const address = deriveAddressFromPubkey(pubkey, msg.coin, msg.scriptType);
  if (!address) return null;

  return msg.coin.toLowerCase() === "bitcoincash" ? toCashAddress(address) : address;
}

export async function btcSignTx(client: Client, msg: core.BTCSignTx): Promise<core.BTCSignedTx | null> {
  const psbt = new bitcoin.Psbt({
    network: core.getNetwork(msg.coin),
    forkCoin: msg.coin.toLowerCase() === "bitcoincash" ? "bch" : "none",
  });

  psbt.setVersion(msg.version ?? 2);
  msg.locktime && psbt.setLocktime(msg.locktime);

  for (const input of msg.inputs) {
    if (!input.hex) throw new Error("Invalid input (missing hex)");

    const pubkey = await getPublicKey(client, input.addressNList);
    const network = core.getNetwork(msg.coin, input.scriptType);
    const redeemScript = core.createPayment(pubkey, network, input.scriptType)?.redeem?.output;

    psbt.addInput({
      hash: input.txid,
      index: input.vout,
      nonWitnessUtxo: Buffer.from(input.hex, "hex"),
      ...(redeemScript && { redeemScript }),
    });
  }

  for (const output of msg.outputs) {
    if (!output.amount) throw new Error("Invalid output (missing amount)");

    const address = await (async () => {
      if (!output.address && !output.addressNList) {
        throw new Error("Invalid output (missing address or addressNList)");
      }

      const _address =
        output.address ??
        (await btcGetAddress(client, {
          addressNList: output.addressNList,
          coin: msg.coin,
          scriptType: output.scriptType as any,
        }));

      if (!_address) throw new Error("No public key for spend output");

      return msg.coin.toLowerCase() === "bitcoincash" ? toLegacyAddress(_address) : _address;
    })();

    psbt.addOutput({ address, value: BigInt(output.amount) });
  }

  if (msg.opReturnData) {
    const data = Buffer.from(msg.opReturnData, "utf-8");
    const script = bitcoin.payments.embed({ data: [data] }).output;
    if (!script) throw new Error("unable to build OP_RETURN script");
    // OP_RETURN_DATA outputs always have a value of 0
    psbt.addOutput({ script, value: BigInt(0) });
  }

  for (let i = 0; i < msg.inputs.length; i++) {
    const input = msg.inputs[i];
    const pubkey = await getPublicKey(client, input.addressNList);

    const signer: bitcoin.SignerAsync = {
      publicKey: pubkey,
      sign: async (hash) => {
        const { sig } = await client.sign({
          data: {
            payload: hash,
            curveType: Constants.SIGNING.CURVES.SECP256K1,
            hashType: Constants.SIGNING.HASHES.SHA256,
            encodingType: Constants.SIGNING.ENCODINGS.NONE,
            signerPath: input.addressNList,
          },
        });

        if (!sig) throw new Error(`No signature returned from device for input ${i}`);

        const { r, s } = sig;

        if (!Buffer.isBuffer(r)) throw new Error("Invalid signature (r)");
        if (!Buffer.isBuffer(s)) throw new Error("Invalid signature (s)");

        return Buffer.concat([r, s]);
      },
    };

    // single sha256 hash and allow device to perform second sha256 hash when signing (pending gridplus fix for hashType.NONE)
    await psbt.signInputAsync(i, signer, undefined, true);
  }

  psbt.finalizeAllInputs();

  const tx = psbt.extractTransaction();

  const signatures = tx.ins.map((input) => {
    if (input.witness.length > 0) {
      return Buffer.from(input.witness[0]).toString("hex");
    } else {
      const sigLen = input.script[0];
      return Buffer.from(input.script.slice(1, sigLen)).toString("hex");
    }
  });

  return { signatures, serializedTx: tx.toHex() };
}
