import * as core from "@shapeshiftoss/hdwallet-core";
import { PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import { Client, Constants } from "gridplus-sdk";

export async function solanaGetAddress(client: Client, msg: core.SolanaGetAddress): Promise<string | null> {
  if (msg.pubKey) return msg.pubKey;

  const startPath = core.ed25519Path(msg.addressNList);

  const pubkey = (await client.getAddresses({ startPath, n: 1, flag: Constants.GET_ADDR_FLAGS.ED25519_PUB }))[0];

  if (!pubkey) throw new Error("No address returned from device");
  if (!Buffer.isBuffer(pubkey)) throw new Error("Invalid public key");

  return bs58.encode(pubkey);
}

export async function solanaSignTx(client: Client, msg: core.SolanaSignTx): Promise<core.SolanaSignedTx | null> {
  const address = await solanaGetAddress(client, { addressNList: msg.addressNList, pubKey: msg.pubKey });
  if (!address) throw new Error("Failed to get Solana address");

  const transaction = core.solanaBuildTransaction(msg, address);
  const messageBytes = transaction.message.serialize();

  const signData = await client.sign({
    data: {
      payload: messageBytes,
      curveType: Constants.SIGNING.CURVES.ED25519,
      hashType: Constants.SIGNING.HASHES.NONE,
      encodingType: Constants.SIGNING.ENCODINGS.SOLANA,
      signerPath: core.ed25519Path(msg.addressNList),
    },
  });

  if (!signData?.sig) throw new Error("No signature returned from device");

  const { r, s } = signData.sig;

  if (!Buffer.isBuffer(r)) throw new Error("Invalid signature (r)");
  if (!Buffer.isBuffer(s)) throw new Error("Invalid signature (s)");

  const signature = Buffer.concat([r, s]);

  transaction.addSignature(new PublicKey(address), signature);

  return {
    serialized: Buffer.from(transaction.serialize()).toString("base64"),
    signatures: transaction.signatures.map((sig) => Buffer.from(sig).toString("base64")),
  };
}
