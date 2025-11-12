import * as core from "@shapeshiftoss/hdwallet-core";
import { PublicKey } from "@solana/web3.js";

import { TrezorTransport } from "./transport";
import { handleError } from "./utils";

export async function solanaGetAddress(transport: TrezorTransport, msg: core.SolanaGetAddress): Promise<string> {
  const res = await transport.call("solanaGetAddress", {
    path: core.solanaAddressNListToBIP32(msg.addressNList),
    showOnTrezor: !!msg.showDisplay,
  });

  handleError(transport, res, "Unable to obtain Solana address from Trezor");

  return res.payload.address;
}

export async function solanaSignTx(transport: TrezorTransport, msg: core.SolanaSignTx): Promise<core.SolanaSignedTx> {
  const address = await solanaGetAddress(transport, msg);

  const transaction = core.solanaBuildTransaction(msg, address);
  const serializedMessage = Buffer.from(transaction.message.serialize());

  const res = await transport.call("solanaSignTransaction", {
    path: core.solanaAddressNListToBIP32(msg.addressNList),
    serializedTx: serializedMessage.toString("hex"),
  });

  handleError(transport, res, "Unable to sign Solana transaction with Trezor");

  const signature = Buffer.from(res.payload.signature, "hex");
  transaction.addSignature(new PublicKey(address), signature);

  return {
    serialized: Buffer.from(transaction.serialize()).toString("base64"),
    signatures: transaction.signatures.map((sig) => Buffer.from(sig).toString("base64")),
  };
}
