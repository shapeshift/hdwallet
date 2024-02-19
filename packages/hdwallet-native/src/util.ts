import * as core from "@shapeshiftoss/hdwallet-core";
import type { BytesLike } from "ethers";
import { concat, getBytes, isHexString, toUtf8Bytes } from "ethers";

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

export function buildMessage(message: BytesLike): Uint8Array {
  const messageBytes = typeof message === "string" && !isHexString(message) ? toUtf8Bytes(message) : getBytes(message);

  return getBytes(
    concat([toUtf8Bytes("\x19Ethereum Signed Message:\n"), toUtf8Bytes(String(messageBytes.length)), messageBytes])
  );
}
