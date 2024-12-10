import * as core from "@shapeshiftoss/hdwallet-core";
import { PublicKey } from "@solana/web3.js";
import * as bs58 from "bs58";

import { LedgerTransport } from "./transport";
import { handleError } from "./utils";

// ledger expects m/ prefix to be stripped
// https://www.npmjs.com/package/@ledgerhq/hw-app-solana#getaddress
function addressNListToBIP32Path(addressNList: core.BIP32Path): string {
  return core.solanaAddressNListToBIP32(addressNList).slice(2);
}

export async function solanaGetAddress(transport: LedgerTransport, msg: core.SolanaGetAddress): Promise<string> {
  const bip32Path = addressNListToBIP32Path(msg.addressNList);

  const res = await transport.call("Solana", "getAddress", bip32Path, !!msg.showDisplay);
  handleError(res, transport, "Unable to obtain address from device.");

  // solana address format is a base58 encoded string
  // https://github.com/LedgerHQ/ledger-live/blob/develop/libs/coin-modules/coin-solana/src/hw-getAddress.ts#L12
  return bs58.encode(res.payload.address);
}

export async function solanaSignTx(transport: LedgerTransport, msg: core.SolanaSignTx): Promise<core.SolanaSignedTx> {
  const address = await solanaGetAddress(transport, msg);

  const bip32Path = addressNListToBIP32Path(msg.addressNList);

  const transaction = core.solanaBuildTransaction(msg, address);
  const txBuffer = Buffer.from(transaction.message.serialize());

  const res = await transport.call("Solana", "signTransaction", bip32Path, txBuffer);
  handleError(res, transport, "Unable to sign Solana transaction");

  transaction.addSignature(new PublicKey(address), res.payload.signature);

  return {
    serialized: Buffer.from(transaction.serialize()).toString("base64"),
    signatures: transaction.signatures.map((signature) => Buffer.from(signature).toString("base64")),
  };
}
