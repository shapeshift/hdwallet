import * as core from "@shapeshiftoss/hdwallet-core";

import { TrezorTransport } from "./transport";
import { handleError } from "./utils";

export async function nearGetAddress(transport: TrezorTransport, msg: core.NearGetAddress): Promise<string> {
  const res = await transport.call("nearGetAddress", {
    path: core.nearAddressNListToBIP32(msg.addressNList),
    showOnTrezor: !!msg.showDisplay,
  });

  handleError(transport, res, "Unable to obtain NEAR address from Trezor");

  return res.payload.address;
}

export async function nearGetAddresses(transport: TrezorTransport, msgs: core.NearGetAddress[]): Promise<string[]> {
  if (!msgs.length) return [];

  const bundle = msgs.map((msg) => ({
    path: core.nearAddressNListToBIP32(msg.addressNList),
    showOnTrezor: false,
  }));

  const res = await transport.call("nearGetAddress", { bundle });

  handleError(transport, res, "Unable to obtain NEAR addresses from Trezor");

  const addresses = (res.payload as Array<{ address: string }>).map((item) => item.address);
  return addresses;
}

export async function nearSignTx(transport: TrezorTransport, msg: core.NearSignTx): Promise<core.NearSignedTx> {
  const address = await nearGetAddress(transport, { addressNList: msg.addressNList });

  const res = await transport.call("nearSignTransaction", {
    path: core.nearAddressNListToBIP32(msg.addressNList),
    rawTx: Buffer.from(msg.txBytes).toString("hex"),
  });

  handleError(transport, res, "Unable to sign NEAR transaction with Trezor");

  return {
    signature: res.payload.signature,
    publicKey: address,
  };
}

export function nearGetAccountPaths(msg: core.NearGetAccountPaths): Array<core.NearAccountPath> {
  return core.nearGetAccountPaths(msg);
}

export function nearNextAccountPath(msg: core.NearAccountPath): core.NearAccountPath | undefined {
  const addressNList = msg.addressNList;
  if (
    addressNList[0] === 0x80000000 + 44 &&
    addressNList[1] === 0x80000000 + core.slip44ByCoin("Near") &&
    addressNList[3] === 0x80000000 + 0 &&
    addressNList[4] === 0x80000000 + 0
  ) {
    return {
      addressNList: [
        0x80000000 + 44,
        0x80000000 + core.slip44ByCoin("Near"),
        addressNList[2] + 1,
        0x80000000 + 0,
        0x80000000 + 0,
      ],
    };
  }
  return undefined;
}
