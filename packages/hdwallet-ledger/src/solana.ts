import * as core from "@shapeshiftoss/hdwallet-core";
import * as bs58 from "bs58";

import { LedgerTransport } from "./transport";
import { handleError } from "./utils";

export async function solanaGetAddress(transport: LedgerTransport, msg: core.SolanaGetAddress): Promise<string> {
  const bip32path = core.addressNListToBIP32(msg.addressNList);
  const res = await transport.call("Solana", "getAddress", bip32path.replace("m/", ""), !!msg.showDisplay);
  handleError(res, transport, "Unable to obtain Solana address from device.");

  const addressBuffer = res.payload.address;

  // https://github.com/LedgerHQ/ledger-live-common/blob/60b8e77b44107b98f50758b80a01ebb850ab4e26/src/families/solana/hw-getAddress.ts#L11
  // address is returned from solana.getAddress() as a Buffer and needs to be encoded as a base58 string, which is the Solana address format
  return bs58.encode(addressBuffer);
}
