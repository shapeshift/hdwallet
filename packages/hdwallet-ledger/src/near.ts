import * as core from "@shapeshiftoss/hdwallet-core";

import { LedgerTransport } from "./transport";
import { handleError } from "./utils";

function addressNListToBIP32Path(addressNList: core.BIP32Path): string {
  return core.addressNListToHardenedBIP32(addressNList).slice(2);
}

export async function nearGetAddress(transport: LedgerTransport, msg: core.NearGetAddress): Promise<string> {
  const bip32Path = addressNListToBIP32Path(msg.addressNList);

  const res = await transport.call("Near", "getAddress", bip32Path, !!msg.showDisplay);
  handleError(res, transport, "Unable to obtain NEAR address from device.");

  // @ledgerhq/hw-app-near returns { address: "64-char-hex", publicKey: "ed25519:base58..." }
  // NEAR implicit accounts use the 64-char hex format (same as native hdwallet)
  return res.payload.address;
}

export async function nearSignTx(transport: LedgerTransport, msg: core.NearSignTx): Promise<core.NearSignedTx> {
  const bip32Path = addressNListToBIP32Path(msg.addressNList);

  const publicKey = await nearGetAddress(transport, { addressNList: msg.addressNList });

  const txBuffer = msg.txBytes instanceof Uint8Array ? msg.txBytes : new Uint8Array(msg.txBytes);

  const res = await transport.call("Near", "signTransaction", txBuffer, bip32Path);
  handleError(res, transport, "Unable to sign NEAR transaction.");

  if (!res.payload) {
    throw new Error("NEAR transaction signing failed: no signature returned");
  }

  // Convert signature Buffer to hex string (same format as native hdwallet)
  const signatureHex = Buffer.from(res.payload).toString("hex");

  return {
    signature: signatureHex,
    publicKey,
  };
}

export function nearGetAccountPaths(msg: core.NearGetAccountPaths): Array<core.NearAccountPath> {
  return core.nearGetAccountPaths(msg);
}

export function nearNextAccountPath(msg: core.NearAccountPath): core.NearAccountPath | undefined {
  const addressNList = msg.addressNList;
  if (
    addressNList.length === 3 &&
    addressNList[0] === 0x80000000 + 44 &&
    addressNList[1] === 0x80000000 + core.slip44ByCoin("Near") &&
    (addressNList[2] & 0x80000000) >>> 0 === 0x80000000
  ) {
    return {
      addressNList: [
        0x80000000 + 44,
        0x80000000 + core.slip44ByCoin("Near"),
        addressNList[2] + 1,
      ],
    };
  }
  return undefined;
}
