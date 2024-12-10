import * as core from "@shapeshiftoss/hdwallet-core";
import * as bs58 from "bs58";

import { LedgerTransport } from "./transport";
import { handleError } from "./utils";
import { buildTransaction } from "@shapeshiftoss/hdwallet-core";

const HARDENED = 0x80000000;

// This ensures we generate a derivation compatible with both hw-app-solana (stripped m/) and Phantom (added hardened change component)
// Using good ol' core.bip32ToAddressNList here = problems
// https://help.phantom.com/hc/en-us/articles/12988493966227-What-derivation-paths-does-Phantom-wallet-support#h_01HFBRSYQKC73Z43HPKKW0C1SS
// https://www.npmjs.com/package/@ledgerhq/hw-app-solana#getaddress
const addressNListToSolanaDerivationPath = (addressNList: number[]): string => {
  const solanaComponents = addressNList.slice(0, 3);

  const basePath = solanaComponents.map((num) => (num >= HARDENED ? `${num - HARDENED}'` : num)).join("/");

  return `${basePath}/0'`;
};

export async function solanaGetAddress(transport: LedgerTransport, msg: core.SolanaGetAddress): Promise<string> {
  const bip32Path = addressNListToSolanaDerivationPath(msg.addressNList);
  const res = await transport.call("Solana", "getAddress", bip32Path, !!msg.showDisplay);
  handleError(res, transport, "Unable to obtain Solana address from device.");

  const addressBuffer = res.payload.address;

  // https://github.com/LedgerHQ/ledger-live-common/blob/60b8e77b44107b98f50758b80a01ebb850ab4e26/src/families/solana/hw-getAddress.ts#L11
  // address is returned from solana.getAddress() as a Buffer and needs to be encoded as a base58 string, which is the Solana address format
  return bs58.encode(addressBuffer);
}

export async function solanaSignTx(
  transport: LedgerTransport,
  msg: core.SolanaSignTx,
  address: string
): Promise<core.SolanaSignedTx> {
  const transaction = core.buildTransaction(msg, address);
  const message = transaction.message.serialize();
  const serializedMessage = Buffer.from(message);

  const bip32Path = addressNListToSolanaDerivationPath(msg.addressNList);
  const res = await transport.call("Solana", "signTransaction", bip32Path, serializedMessage);
  handleError(res, transport, "Unable to sign Solana transaction");

  const signature = res.payload.signature;
  // no multisig here, so mutate transaction with the only signature once we have it
  transaction.signatures[0] = signature;

  return {
    serialized: Buffer.from(transaction.serialize()).toString("base64"),
    signatures: [Buffer.from(signature).toString("base64")],
  };
}
