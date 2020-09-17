import { addressNListToBIP32 } from "@shapeshiftoss/hdwallet-core";
import * as bitcoin from "bitcoinjs-lib";
import { BIP32Interface, Network } from "bitcoinjs-lib";
import { getNetwork } from "./networks";

export function getKeyPair(
  seed: BIP32Interface,
  addressNList: number[],
  network = "bitcoin"
): { privateKey: string; publicKey: string } {
  const path = addressNListToBIP32(addressNList);
  const keypair = bitcoin.ECPair.fromWIF(seed.derivePath(path).toWIF(), getNetwork(network));
  return {
    privateKey: keypair.privateKey.toString("hex"),
    publicKey: keypair.publicKey.toString("hex"),
  };
}
