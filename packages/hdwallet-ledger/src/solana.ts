import * as core from "@shapeshiftoss/hdwallet-core";
import * as bs58 from "bs58";

import { LedgerTransport } from "./transport";
import { handleError } from "./utils";

const HARDENED = 0x80000000;

// This ensures we generate a derivation compatible with both hw-app-solana (stripped m/) and Phantom (added hardened change component)
// Using good ol' core.bip32ToAddressNList here = problems
// https://help.phantom.com/hc/en-us/articles/12988493966227-What-derivation-paths-does-Phantom-wallet-support#h_01HFBRSYQKC73Z43HPKKW0C1SS
// https://www.npmjs.com/package/@ledgerhq/hw-app-solana#getaddress
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const addressNListToSolanaDerivationPath = (addressNList: number[]): string => {
  const solanaComponents = addressNList.slice(0, 3);

  const basePath = solanaComponents.map((num) => (num >= HARDENED ? `${num - HARDENED}'` : num)).join("/");

  return `${basePath}/0'`;
};

export async function solanaGetAddress(transport: LedgerTransport, msg: core.SolanaGetAddress): Promise<string> {
  // debugging only, rm me
  const bip32path = "44'/501'";
  const res = await transport.call("Solana", "getAddress", bip32path, !!msg.showDisplay);
  handleError(res, transport, "Unable to obtain Solana address from device.");

  const addressBuffer = res.payload.address;

  // https://github.com/LedgerHQ/ledger-live-common/blob/60b8e77b44107b98f50758b80a01ebb850ab4e26/src/families/solana/hw-getAddress.ts#L11
  // address is returned from solana.getAddress() as a Buffer and needs to be encoded as a base58 string, which is the Solana address format
  return bs58.encode(addressBuffer);
}
