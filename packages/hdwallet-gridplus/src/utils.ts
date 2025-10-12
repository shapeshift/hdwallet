import * as core from "@shapeshiftoss/hdwallet-core";
import * as bech32 from "bech32";
import { encode as bs58Encode, decode as bs58Decode } from "bs58check";
import CryptoJS from "crypto-js";
import { UtxoAccountType, accountTypeToVersion, convertVersions, UTXO_NETWORK_PARAMS } from "./constants";

/**
 * Convert xpub version bytes for different coins (e.g., xpub → dgub for Dogecoin)
 * GridPlus returns Bitcoin-format xpubs, but some coins like Dogecoin need different prefixes
 */
export function convertXpubVersion(xpub: string, accountType: UtxoAccountType | undefined, coin: string): string {
  if (!accountType) return xpub;
  if (!convertVersions.includes(xpub.substring(0, 4))) {
    return xpub;
  }

  const payload = bs58Decode(xpub);
  const version = payload.slice(0, 4);
  const desiredVersion = accountTypeToVersion(coin, accountType);
  if (version.compare(desiredVersion) !== 0) {
    const key = payload.slice(4);
    return bs58Encode(Buffer.concat([desiredVersion, key]));
  }
  return xpub;
}

export function scriptTypeToAccountType(scriptType: core.BTCInputScriptType | undefined): UtxoAccountType | undefined {
  switch (scriptType) {
    case core.BTCInputScriptType.SpendAddress:
      return UtxoAccountType.P2pkh;
    case core.BTCInputScriptType.SpendWitness:
      return UtxoAccountType.SegwitNative;
    case core.BTCInputScriptType.SpendP2SHWitness:
      return UtxoAccountType.SegwitP2sh;
    default:
      return undefined;
  }
}

/**
 * Derive a UTXO address from a compressed public key
 * @param pubkeyHex - Compressed public key as hex string (33 bytes, starting with 02 or 03)
 * @param coin - Coin name (Bitcoin, Dogecoin, Litecoin, etc.)
 * @param scriptType - Script type (p2pkh, p2wpkh, p2sh-p2wpkh)
 * @returns The derived address
 */
export function deriveAddressFromPubkey(
  pubkeyHex: string,
  coin: string,
  scriptType: core.BTCInputScriptType = core.BTCInputScriptType.SpendAddress
): string {
  const network = UTXO_NETWORK_PARAMS[coin] || UTXO_NETWORK_PARAMS.Bitcoin;
  const pubkeyBuffer = Buffer.from(pubkeyHex, "hex");

  if (pubkeyBuffer.length !== 33) {
    throw new Error(`Invalid compressed public key length: ${pubkeyBuffer.length} bytes`);
  }

  // Hash160 = RIPEMD160(SHA256(pubkey))
  const sha256Hash = CryptoJS.SHA256(CryptoJS.enc.Hex.parse(pubkeyHex));
  const hash160 = CryptoJS.RIPEMD160(sha256Hash).toString();
  const hash160Buffer = Buffer.from(hash160, "hex");

  switch (scriptType) {
    case core.BTCInputScriptType.SpendAddress: {
      // P2PKH: <pubKeyHash version byte> + hash160 + checksum
      const payload = Buffer.concat([Buffer.from([network.pubKeyHash]), hash160Buffer]);
      return bs58Encode(payload);
    }

    case core.BTCInputScriptType.SpendWitness: {
      // P2WPKH (bech32): witness version 0 + hash160
      if (!network.bech32) {
        throw new Error(`Bech32 not supported for ${coin}`);
      }
      const words = bech32.toWords(hash160Buffer);
      words.unshift(0); // witness version 0
      return bech32.encode(network.bech32, words);
    }

    case core.BTCInputScriptType.SpendP2SHWitness: {
      // P2SH-P2WPKH: scriptHash of witness program
      // Witness program: OP_0 (0x00) + length (0x14) + hash160
      const witnessProgram = Buffer.concat([Buffer.from([0x00, 0x14]), hash160Buffer]);

      // Hash160 of witness program
      const wpHex = witnessProgram.toString("hex");
      const wpSha256 = CryptoJS.SHA256(CryptoJS.enc.Hex.parse(wpHex));
      const wpHash160 = CryptoJS.RIPEMD160(wpSha256).toString();
      const wpHash160Buffer = Buffer.from(wpHash160, "hex");

      // Encode with scriptHash version byte
      const payload = Buffer.concat([Buffer.from([network.scriptHash]), wpHash160Buffer]);
      return bs58Encode(payload);
    }

    default:
      throw new Error(`Unsupported script type: ${scriptType}`);
  }
}
