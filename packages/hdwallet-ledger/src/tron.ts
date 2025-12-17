import * as core from "@shapeshiftoss/hdwallet-core";

import { LedgerTransport } from "./transport";
import { handleError } from "./utils";

export async function tronGetAddress(transport: LedgerTransport, msg: core.TronGetAddress): Promise<string> {
  const bip32path = core.addressNListToBIP32(msg.addressNList);

  const res = await transport.call("Tron", "getAddress", bip32path, !!msg.showDisplay);
  handleError(res, transport, "Unable to obtain Tron address from device.");

  return res.payload.address;
}

/**
 * Detects if a TRON transaction contains a memo in the raw_data.data field
 * by checking for protobuf field 10 (wire type 2 for bytes) = 0x52
 */
function transactionHasMemo(rawDataHex: string): boolean {
  try {
    const buffer = Buffer.from(rawDataHex, "hex");

    // Search for field 10 with wire type 2 (bytes)
    // Field number 10, wire type 2 (length-delimited) = (10 << 3) | 2 = 0x52
    for (let i = 0; i < buffer.length - 1; i++) {
      if (buffer[i] === 0x52) {
        return true;
      }
    }

    return false;
  } catch (err) {
    return false;
  }
}

export async function tronSignTx(transport: LedgerTransport, msg: core.TronSignTx): Promise<core.TronSignedTx> {
  const bip32path = core.addressNListToBIP32(msg.addressNList);

  // Check if transaction has memo and validate Ledger app configuration
  const hasMemo = transactionHasMemo(msg.rawDataHex);

  if (hasMemo) {
    const configRes = await transport.call("Tron", "getAppConfiguration");
    handleError(configRes, transport, "Unable to get Tron app configuration from device.");

    const { allowData } = configRes.payload;

    if (!allowData) {
      const error = new Error("Please enable Transactions Data in your Ledger TRON app settings and try again.");
      (error as any).name = "LedgerTronAllowDataDisabled";
      throw error;
    }
  }

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
      addressNList: [0x80000000 + 44, 0x80000000 + core.slip44ByCoin("Tron"), addressNList[2] + 1, 0, 0],
    };
  }
  return undefined;
}
