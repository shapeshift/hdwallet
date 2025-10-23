import * as core from "@shapeshiftoss/hdwallet-core";

import { BTCScriptType } from "./bitcoin";
import * as Isolation from "./crypto/isolation";

export async function getKeyPair(
  node: Isolation.Core.BIP32.Node,
  addressNList: number[],
  coin: core.Coin,
  scriptType?: BTCScriptType
): Promise<Isolation.Adapters.BIP32> {
  const network = core.getNetwork(coin, scriptType ?? core.BTCOutputScriptType.PayToMultisig);
  const wallet = await Isolation.Adapters.BIP32.create(node, network);
  const path = core.addressNListToBIP32(addressNList);
  return await wallet.derivePath(path);
}
