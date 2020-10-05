import { addressNListToBIP32, BTCInputScriptType, BTCOutputScriptType } from "@shapeshiftoss/hdwallet-core";
import * as bitcoin from "bitcoinjs-lib";
import { BIP32Interface } from "bitcoinjs-lib";
import { getNetwork } from "./networks";

type BTCScriptType = BTCInputScriptType | BTCOutputScriptType;

function getKeyPair(
  seed: BIP32Interface,
  addressNList: number[],
  network = "bitcoin",
  scriptType?: BTCScriptType
): { privateKey: string; publicKey: string } {
  const path = addressNListToBIP32(addressNList);
  const keypair = bitcoin.ECPair.fromWIF(seed.derivePath(path).toWIF(), getNetwork(network, scriptType));
  return {
    privateKey: keypair.privateKey.toString("hex"),
    publicKey: keypair.publicKey.toString("hex"),
  };
}

// Prevent malicious JavaScript from replacing the method
export default Object.freeze({
  getKeyPair,
});
