import * as core from "@shapeshiftoss/hdwallet-core";
import { PublicKey } from "@solana/web3.js";

import { TrezorTransport } from "./transport";
import { handleError } from "./utils";

export async function solanaGetAddress(transport: TrezorTransport, msg: core.SolanaGetAddress): Promise<string> {
  if (msg.pubKey) return msg.pubKey;

  const res = await transport.call("solanaGetAddress", {
    path: core.solanaAddressNListToBIP32(msg.addressNList),
    showOnTrezor: !!msg.showDisplay,
  });

  handleError(transport, res, "Unable to obtain Solana address from Trezor");

  return res.payload.address;
}

export async function solanaGetAddresses(transport: TrezorTransport, msgs: core.SolanaGetAddress[]): Promise<string[]> {
  if (!msgs.length) return [];

  // Check if any have pubKey bypass - handle those separately
  const results: string[] = [];
  const needsDeviceIndices: number[] = [];
  const needsDeviceMsgs: core.SolanaGetAddress[] = [];

  msgs.forEach((msg, i) => {
    if (msg.pubKey) {
      results[i] = msg.pubKey;
    } else {
      results[i] = ""; // placeholder
      needsDeviceIndices.push(i);
      needsDeviceMsgs.push(msg);
    }
  });

  // If all bypassed, return early
  if (needsDeviceMsgs.length === 0) return results;

  // Build bundle request for Trezor Connect
  const bundle = needsDeviceMsgs.map((msg) => ({
    path: core.solanaAddressNListToBIP32(msg.addressNList),
    showOnTrezor: false, // Never show on device for batch requests
  }));

  // Single popup for all addresses via Trezor Connect bundle parameter
  const res = await transport.call("solanaGetAddress", { bundle });

  handleError(transport, res, "Unable to obtain Solana addresses from Trezor");

  // Fill in device-derived addresses
  const addresses = (res.payload as Array<{ address: string }>).map((item) => item.address);
  needsDeviceIndices.forEach((originalIndex, j) => {
    results[originalIndex] = addresses[j];
  });

  return results;
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
