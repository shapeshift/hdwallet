import * as core from "@shapeshiftoss/hdwallet-core";
import { ethers } from "ethers";

import { BTCScriptType } from "./bitcoin";
import * as Isolation from "./crypto/isolation";
import { getNetwork } from "./networks";

export async function getKeyPair(
  node: Isolation.Core.BIP32.Node,
  addressNList: number[],
  coin: core.Coin,
  scriptType?: BTCScriptType
): Promise<Isolation.Adapters.BIP32> {
  const network = getNetwork(coin, scriptType);
  const wallet = await Isolation.Adapters.BIP32.create(node, network);
  const path = core.addressNListToBIP32(addressNList);
  return await wallet.derivePath(path);
}

export function buildMessage(message: ethers.utils.BytesLike): Uint8Array {
  const messageBytes =
    typeof message === "string" && !ethers.utils.isHexString(message)
      ? ethers.utils.toUtf8Bytes(message)
      : ethers.utils.arrayify(message);

  return ethers.utils.concat([
    ethers.utils.toUtf8Bytes("\x19Ethereum Signed Message:\n"),
    ethers.utils.toUtf8Bytes(String(messageBytes.length)),
    messageBytes,
  ]);
}
