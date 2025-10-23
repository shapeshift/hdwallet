import * as core from "@shapeshiftoss/hdwallet-core";
import { PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import { Client, Constants } from "gridplus-sdk";

export async function solanaGetAddress(client: Client, msg: core.SolanaGetAddress): Promise<string | null> {
  // Solana requires all path indices to be hardened (BIP32 hardened derivation)
  // Hardening is indicated by setting the highest bit (0x80000000)
  // If an index is already >= 0x80000000, it's already hardened; otherwise add 0x80000000
  const correctedPath = msg.addressNList.map((idx) => {
    if (idx >= 0x80000000) {
      return idx;
    } else {
      return idx + 0x80000000;
    }
  });

  const allHardened = correctedPath.every((idx) => idx >= 0x80000000);

  if (!allHardened) {
    throw new Error("Failed to harden all Solana path indices for ED25519");
  }

  const fwVersion = client.getFwVersion();

  if (fwVersion.major === 0 && fwVersion.minor < 14) {
    throw new Error(
      `Solana requires firmware >= 0.14.0, current: ${fwVersion.major}.${fwVersion.minor}.${fwVersion.fix}`
    );
  }

  const addresses = await client.getAddresses({
    startPath: correctedPath,
    n: 1,
    flag: Constants.GET_ADDR_FLAGS.ED25519_PUB,
  });

  if (!addresses.length) {
    throw new Error("No address returned from device");
  }

  const pubkeyBuffer = Buffer.isBuffer(addresses[0]) ? addresses[0] : Buffer.from(addresses[0], "hex");

  const address = bs58.encode(pubkeyBuffer);

  return address;
}

export async function solanaSignTx(client: Client, msg: core.SolanaSignTx): Promise<core.SolanaSignedTx | null> {
  // Ensure all path indices are hardened for Solana (see solanaGetAddress for explanation)
  const correctedPath = msg.addressNList.map((idx) => {
    if (idx >= 0x80000000) return idx;
    return idx + 0x80000000;
  });

  const allHardened = correctedPath.every((idx) => idx >= 0x80000000);
  if (!allHardened) {
    throw new Error("Failed to harden all Solana path indices - this should never happen");
  }

  const address = await solanaGetAddress(client, {
    addressNList: correctedPath,
    showDisplay: false,
  });

  if (!address) throw new Error("Failed to get Solana address");

  const transaction = core.solanaBuildTransaction(msg, address);
  const messageBytes = transaction.message.serialize();

  const signingRequest = {
    data: {
      signerPath: correctedPath,
      curveType: Constants.SIGNING.CURVES.ED25519,
      hashType: Constants.SIGNING.HASHES.NONE,
      encodingType: Constants.SIGNING.ENCODINGS.SOLANA,
      payload: Buffer.from(messageBytes),
    },
  };

  const signData = await client.sign(signingRequest);

  if (!signData || !signData.sig) {
    throw new Error("No signature returned from device");
  }

  const signature = Buffer.concat([signData.sig.r, signData.sig.s]);

  transaction.addSignature(new PublicKey(address), signature);

  const serializedTx = transaction.serialize();

  return {
    serialized: Buffer.from(serializedTx).toString("base64"),
    signatures: transaction.signatures.map((sig) => Buffer.from(sig).toString("base64")),
  };
}
