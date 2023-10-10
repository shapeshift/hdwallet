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

  const maybeAddress = (addressAndPubkey.payload as any)?.bech32_address as string | undefined;
  if (!maybeAddress) return null;

  return maybeAddress;
};

export const thorchainSignTx = async (
  transport: LedgerTransport,
  msg: core.ThorchainSignTx
): Promise<core.ThorchainSignedTx> => {
  const signed = await transport.call(
    "Rune",
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore TODO(gomes): fixme
    "sign",
    core.addressNListToBIP32(msg.addressNList),
    msg
  );

  // eslint-disable-next-line no-console
  console.log({ signed });

  const maybeSigned = signed;
  if (!maybeSigned) throw new Error("TODO error handling");

  return maybeSigned as unknown as core.ThorchainSignedTx;
};
