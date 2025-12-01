import * as core from "@shapeshiftoss/hdwallet-core";

import { LedgerTransport } from "./transport";
import { handleError } from "./utils";

export async function tronGetAddress(transport: LedgerTransport, msg: core.TronGetAddress): Promise<string> {
  const bip32path = core.addressNListToBIP32(msg.addressNList);

  const res = await transport.call("Tron", "getAddress", bip32path, !!msg.showDisplay);
  handleError(res, transport, "Unable to obtain Tron address from device.");

  return res.payload.address;
}

export async function tronSignTx(transport: LedgerTransport, msg: core.TronSignTx): Promise<core.TronSignedTx> {
  const bip32path = core.addressNListToBIP32(msg.addressNList);

  const res = await transport.call("Tron", "signTransaction", bip32path, msg.rawDataHex, []);
  handleError(res, transport, "Unable to sign Tron transaction.");

  const signature = res.payload;

  return {
    signature,
    serialized: msg.rawDataHex + signature,
  };
}

export function tronGetAccountPaths(msg: core.TronGetAccountPaths): Array<core.TronAccountPath> {
  const slip44 = core.slip44ByCoin("Tron");
  return [
    {
      addressNList: [0x80000000 + 44, 0x80000000 + slip44, 0x80000000 + msg.accountIdx, 0, 0],
    },
  ];
}

export function tronNextAccountPath(msg: core.TronAccountPath): core.TronAccountPath | undefined {
  const addressNList = msg.addressNList;
  if (
    addressNList[0] === 0x80000000 + 44 &&
    addressNList[1] === 0x80000000 + core.slip44ByCoin("Tron") &&
    addressNList[3] === 0 &&
    addressNList[4] === 0
  ) {
    return {
      addressNList: [
        0x80000000 + 44,
        0x80000000 + core.slip44ByCoin("Tron"),
        addressNList[2] + 1,
        0,
        0,
      ],
    };
  }
  return undefined;
}
