import {
  CosmosAccountPath,
  CosmosGetAccountPaths,
  CosmosGetAddress,
  CosmosSignedTx,
  CosmosSignTx,
  slip44ByCoin,
} from "@shapeshiftoss/hdwallet-core";
import { Window as KeplrWindow } from '@keplr-wallet/types'

export enum cosmosSigningModes{
    AMINO = 1,
    PROTOBUF = 2
}

export function cosmosGetAccountPaths(msg: CosmosGetAccountPaths): Array<CosmosAccountPath> {
  return [
    {
      addressNList: [0x80000000 + 44, 0x80000000 + slip44ByCoin("Atom"), 0x80000000 + msg.accountIdx, 0, 0],
    },
  ];
}

export async function cosmosSignTx(msg: CosmosSignTx, mode: cosmosSigningModes): Promise<CosmosSignedTx> {
    switch(mode){
        case cosmosSigningModes.AMINO:
            break;
        case cosmosSigningModes.PROTOBUF:
            break;
        default:
            throw new Error("Unsupported signing mode specified")
    }
  throw "Method not implemented.";
}

export async function cosmosGetAddress(msg: CosmosGetAddress): Promise<string | undefined> {
    const chainId = "cosmoshub-4";
      await window?.keplr?.enable(chainId);
      const offlineSigner = window?.keplr?.getOfflineSigner(chainId);
      const cosmosAddress = (await offlineSigner?.getAccounts())?.[0].address;
      return cosmosAddress
}
