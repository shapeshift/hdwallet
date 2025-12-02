import * as core from "@shapeshiftoss/hdwallet-core";

import { LedgerTransport } from "./transport";
import { handleError } from "./utils";

// Ledger expects m/ prefix to be stripped AND all segments to be hardened for Ed25519
function addressNListToBIP32Path(addressNList: core.BIP32Path): string {
  // Use addressNListToHardenedBIP32 to ensure all segments are hardened, then strip m/
  return core.addressNListToHardenedBIP32(addressNList).slice(2);
}

export async function suiGetAddress(transport: LedgerTransport, msg: core.SuiGetAddress): Promise<string> {
  const bip32path = addressNListToBIP32Path(msg.addressNList);

  try {
    const res = await transport.call("Sui", "getPublicKey", bip32path, !!msg.showDisplay);
    handleError(res, transport, "Unable to obtain Sui address from device.");

    // Convert Uint8Array to hex string with 0x prefix
    const addressBytes =
      res.payload.address instanceof Uint8Array ? res.payload.address : new Uint8Array(res.payload.address);

    const address = "0x" + Buffer.from(addressBytes).toString("hex");
    return address;
  } catch (error) {
    console.error("[Sui Ledger] suiGetAddress error:", error);
    throw error;
  }
}

async function suiGetPublicKey(transport: LedgerTransport, addressNList: core.BIP32Path): Promise<string> {
  const bip32path = addressNListToBIP32Path(addressNList);

  try {
    const res = await transport.call("Sui", "getPublicKey", bip32path, false);
    handleError(res, transport, "Unable to obtain Sui public key from device.");

    // Convert Uint8Array public key to hex string
    const publicKeyBytes =
      res.payload.publicKey instanceof Uint8Array ? res.payload.publicKey : new Uint8Array(res.payload.publicKey);

    const publicKey = Buffer.from(publicKeyBytes).toString("hex");
    return publicKey;
  } catch (error) {
    console.error("[Sui Ledger] suiGetPublicKey error:", error);
    throw error;
  }
}

export async function suiSignTx(transport: LedgerTransport, msg: core.SuiSignTx): Promise<core.SuiSignedTx> {
  const bip32path = addressNListToBIP32Path(msg.addressNList);

  try {
    const res = await transport.call("Sui", "signTransaction", bip32path, Buffer.from(msg.intentMessageBytes));
    handleError(res, transport, "Unable to sign Sui transaction.");

    // Convert Uint8Array signature to hex string
    const signatureBytes =
      res.payload.signature instanceof Uint8Array ? res.payload.signature : new Uint8Array(res.payload.signature);
    const signature = Buffer.from(signatureBytes).toString("hex");

    const publicKey = await suiGetPublicKey(transport, msg.addressNList);

    return {
      signature,
      publicKey,
    };
  } catch (error) {
    console.error("[Sui Ledger] suiSignTx error:", error);
    throw error;
  }
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
