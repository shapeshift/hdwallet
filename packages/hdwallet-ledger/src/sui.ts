import * as core from "@shapeshiftoss/hdwallet-core";

import { LedgerTransport } from "./transport";
import { handleError } from "./utils";

export async function suiGetAddress(transport: LedgerTransport, msg: core.SuiGetAddress): Promise<string> {
  const bip32path = core.addressNListToBIP32(msg.addressNList);

  const res = await transport.call("Sui", "getPublicKey", bip32path, !!msg.showDisplay);
  handleError(res, transport, "Unable to obtain Sui address from device.");

  // Convert Uint8Array to hex string with 0x prefix
  const addressBytes = res.payload.address instanceof Uint8Array
    ? res.payload.address
    : new Uint8Array(res.payload.address);

  return "0x" + Buffer.from(addressBytes).toString("hex");
}

export async function suiSignTx(transport: LedgerTransport, msg: core.SuiSignTx): Promise<core.SuiSignedTx> {
  const bip32path = core.addressNListToBIP32(msg.addressNList);

  const res = await transport.call("Sui", "signTransaction", bip32path, Buffer.from(msg.intentMessageBytes));
  handleError(res, transport, "Unable to sign Sui transaction.");

  // Convert Uint8Array signature to hex string
  const signatureBytes = res.payload.signature instanceof Uint8Array
    ? res.payload.signature
    : new Uint8Array(res.payload.signature);
  const signature = Buffer.from(signatureBytes).toString("hex");

  const publicKey = await suiGetPublicKey(transport, msg.addressNList);

  return {
    signature,
    publicKey,
  };
}

async function suiGetPublicKey(transport: LedgerTransport, addressNList: core.BIP32Path): Promise<string> {
  const bip32path = core.addressNListToBIP32(addressNList);
  const res = await transport.call("Sui", "getPublicKey", bip32path, false);
  handleError(res, transport, "Unable to obtain Sui public key from device.");

  // Convert Uint8Array public key to hex string
  const publicKeyBytes = res.payload.publicKey instanceof Uint8Array
    ? res.payload.publicKey
    : new Uint8Array(res.payload.publicKey);

  return Buffer.from(publicKeyBytes).toString("hex");
}

export function suiGetAccountPaths(msg: core.SuiGetAccountPaths): Array<core.SuiAccountPath> {
  return core.suiGetAccountPaths(msg);
}

export function suiNextAccountPath(msg: core.SuiAccountPath): core.SuiAccountPath | undefined {
  const addressNList = msg.addressNList;
  if (
    addressNList[0] === 0x80000000 + 44 &&
    addressNList[1] === 0x80000000 + core.slip44ByCoin("Sui") &&
    addressNList[3] === 0x80000000 + 0 &&
    addressNList[4] === 0x80000000 + 0
  ) {
    return {
      addressNList: [
        0x80000000 + 44,
        0x80000000 + core.slip44ByCoin("Sui"),
        addressNList[2] + 1,
        0x80000000 + 0,
        0x80000000 + 0,
      ],
    };
  }
  return undefined;
}
