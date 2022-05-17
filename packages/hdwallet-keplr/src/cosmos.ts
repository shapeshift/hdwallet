import * as core from "@shapeshiftoss/hdwallet-core";
import {
  CosmosAccountPath,
  CosmosGetAccountPaths,
  CosmosGetAddress,
  CosmosSignedTx,
  CosmosSignTx,
  slip44ByCoin,
} from "@shapeshiftoss/hdwallet-core";
import { sign } from "@shapeshiftoss/proto-tx-builder";

export function cosmosDescribePath(path: core.BIP32Path): core.PathDescription {
  const pathStr = core.addressNListToBIP32(path);
  const unknown: core.PathDescription = {
    verbose: pathStr,
    coin: "Atom",
    isKnown: false,
  };

  if (path.length != 5) {
    return unknown;
  }

  if (path[0] != 0x80000000 + 44) {
    return unknown;
  }

  if (path[1] != 0x80000000 + slip44ByCoin("Atom")) {
    return unknown;
  }

  if ((path[2] & 0x80000000) >>> 0 !== 0x80000000) {
    return unknown;
  }

  if (path[3] !== 0 || path[4] !== 0) {
    return unknown;
  }

  const index = path[2] & 0x7fffffff;
  return {
    verbose: `Cosmos Account #${index}`,
    accountIdx: index,
    wholeAccount: true,
    coin: "Atom",
    isKnown: true,
    isPrefork: false,
  };
}

export function cosmosGetAccountPaths(msg: CosmosGetAccountPaths): Array<CosmosAccountPath> {
  return [
    {
      addressNList: [0x80000000 + 44, 0x80000000 + slip44ByCoin("Atom"), 0x80000000 + msg.accountIdx, 0, 0],
    },
  ];
}

export async function cosmosGetAddress(state: any): Promise<string | undefined> {
  await window?.keplr?.enable(state.chainId);
  const offlineSigner = window?.keplr?.getOfflineSigner(state.chainId);
  const cosmosAddress = (await offlineSigner?.getAccounts())?.[0].address;
  return cosmosAddress;
}

export async function cosmosSignTx(msg: CosmosSignTx, state: any): Promise<CosmosSignedTx> {
  await state.provider.enable(state.chainId);
  const offlineSigner = state.provider.getOfflineSigner(state.chainId);
  const output = await sign(msg.tx, offlineSigner, msg.sequence, msg.account_number, msg.chain_id);
  return output;
}

/**
 * @todo: Add support for sign/verify message see documentation at:
 * https://github.com/chainapsis/keplr-wallet/blob/fbbc0b6d8eb4859a1663988d1bd90f07c9b74708/docs/api/README.md
 */

export async function cosmosSendTx(msg: CosmosSignTx, state: any): Promise<string | null> {
  /** Broadcast from Keplr is currently unimplemented */
  return null;
}
