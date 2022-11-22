import { StdTx } from "@cosmjs/amino";
import { SignerData } from "@cosmjs/stargate";
import { ChainReference } from "@shapeshiftoss/caip";
import * as core from "@keepkey/hdwallet-core";
import {
  OsmosisAccountPath,
  OsmosisGetAccountPaths,
  OsmosisSignedTx,
  OsmosisSignTx,
  slip44ByCoin,
} from "@keepkey/hdwallet-core";
import { sign } from "@shapeshiftoss/proto-tx-builder";

export function osmosisDescribePath(path: core.BIP32Path): core.PathDescription {
  const pathStr = core.addressNListToBIP32(path);
  const unknown: core.PathDescription = {
    verbose: pathStr,
    coin: "Osmo",
    isKnown: false,
  };

  if (path.length != 5) {
    return unknown;
  }

  if (path[0] != 0x80000000 + 44) {
    return unknown;
  }

  if (path[1] != 0x80000000 + slip44ByCoin("Osmo")) {
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
    verbose: `Osmosis Account #${index}`,
    accountIdx: index,
    wholeAccount: true,
    coin: "Osmo",
    isKnown: true,
    isPrefork: false,
  };
}

export function osmosisGetAccountPaths(msg: OsmosisGetAccountPaths): Array<OsmosisAccountPath> {
  return [
    {
      addressNList: [0x80000000 + 44, 0x80000000 + slip44ByCoin("Osmo"), 0x80000000 + msg.accountIdx, 0, 0],
    },
  ];
}

export async function osmosisGetAddress(provider: any): Promise<string | undefined> {
  const offlineSigner = provider.getOfflineSigner(ChainReference.OsmosisMainnet);
  const osmosisAddress = (await offlineSigner?.getAccounts())?.[0].address;
  return osmosisAddress;
}

export async function osmosisSignTx(provider: any, msg: OsmosisSignTx): Promise<OsmosisSignedTx> {
  const offlineSigner = provider.getOfflineSigner(ChainReference.OsmosisMainnet);

  const address = await osmosisGetAddress(provider);
  if (!address) throw new Error("failed to get address");

  const signerData: SignerData = {
    sequence: Number(msg.sequence),
    accountNumber: Number(msg.account_number),
    chainId: msg.chain_id,
  };

  return await sign(address, msg.tx as StdTx, offlineSigner, signerData, "osmo");
}

/**
 * @todo: Add support for sign/verify message see documentation at:
 * https://github.com/chainapsis/keplr-wallet/blob/fbbc0b6d8eb4859a1663988d1bd90f07c9b74708/docs/api/README.md
 */
