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

  // TODO(gomes): find a way to type payload for hw-app-thor
  const maybeAddress = (addressAndPubkey.payload as any)?.bech32_address as string | undefined;
  if (!maybeAddress) return null;

  return maybeAddress;
};

export const thorchainSignTx = async (
  transport: LedgerTransport,
  msg: core.ThorchainSignTx
): Promise<core.ThorchainSignedTx> => {
  const maybeSigned = await transport.call(
    "Rune",
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore TODO(gomes): fixme
    "sign",
    core.addressNListToBIP32(msg.addressNList),
    msg
  );

  if (!maybeSigned) throw new Error("TODO error handling");

  // TODO(gomes): find a way to type payload for hw-app-thor
  const signed = (maybeSigned.payload as any)?.signature as Uint8Array | undefined;

  if (!signed) throw new Error("TODO error handling");

  // TODO(gomes): be fully compliant to ThorchainSignedTx type
  return { serialized: Buffer.from(signed).toString("hex") } as unknown as core.ThorchainSignedTx;
};
