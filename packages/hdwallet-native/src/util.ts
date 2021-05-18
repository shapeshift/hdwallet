import { addressNListToBIP32, BTCInputScriptType, BTCOutputScriptType } from "@shapeshiftoss/hdwallet-core";
import { getNetwork } from "./networks";
import * as Isolation from "./crypto/isolation";

type BTCScriptType = BTCInputScriptType | BTCOutputScriptType;

function getKeyPair(
  seed: Isolation.BIP32.SeedInterface | Isolation.BIP32.NodeInterface,
  addressNList: number[],
  coin,
  scriptType?: BTCScriptType
): Isolation.Adapters.BIP32 {
  const node = (typeof seed["toMasterKey"] === "function" ? (seed as Isolation.BIP32.SeedInterface).toMasterKey() : (seed as Isolation.BIP32.NodeInterface));
  const network = getNetwork(coin, scriptType);
  const wallet = new Isolation.Adapters.BIP32(node, network);
  const path = addressNListToBIP32(addressNList);
  return wallet.derivePath(path);
}

// Prevent malicious JavaScript from replacing the method
export default Object.freeze({
  getKeyPair,
});
