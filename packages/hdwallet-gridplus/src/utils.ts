import { pointCompress } from "@bitcoinerlab/secp256k1";
import * as bech32 from "bech32";
import * as bs58 from "bs58check";
import CryptoJS from "crypto-js";

export const getCompressedPubkey = (pubkey: string | Buffer): Buffer => {
  // Extended public key (xpub/ypub/zpub)
  if (typeof pubkey === "string") return bs58.decode(pubkey).subarray(45, 78);

  // Already compressed public key (33 bytes)
  if (pubkey.length === 33) return pubkey;

  // Uncompressed public key (65 bytes)
  if (pubkey.length === 65) return Buffer.from(pointCompress(pubkey, true));

  throw new Error("Invalid public key");
};

export const createBech32Address = (pubkey: string | Buffer, prefix: string): string => {
  const pubkeyStr = typeof pubkey === "string" ? pubkey : Buffer.from(pubkey).toString("hex");
  const message = CryptoJS.SHA256(CryptoJS.enc.Hex.parse(pubkeyStr));
  const hash = CryptoJS.RIPEMD160(message).toString();
  const address = Buffer.from(hash, `hex`);
  const words = bech32.toWords(address);
  return bech32.encode(prefix, words);
};
