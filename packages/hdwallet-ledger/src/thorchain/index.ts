import * as core from "@shapeshiftoss/hdwallet-core";

import { LedgerTransport } from "..";
export * from "./common";
export * from "./helpers";
export * from "./hw-app-thor";

// TODO(gomes): move all below to ./thorchain

export const thorchainGetAddress = async (
  transport: LedgerTransport,
  msg: core.ThorchainGetAddress
): Promise<string | null> => {
  const addressAndPubkey = await transport.call(
    "Rune",
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore TODO(gomes): fixme
    "getAddressAndPubKey",
    core.addressNListToBIP32(msg.addressNList),
    "thor"
  );

  // eslint-disable-next-line no-console
  console.log({ addressAndPubkey });
  return "TODO";
};
