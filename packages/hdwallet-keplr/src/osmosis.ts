import {
    OsmosisAccountPath,
    OsmosisGetAccountPaths,
    OsmosisGetAddress,
    OsmosisSignedTx,
    OsmosisSignTx,
    slip44ByCoin,
  } from "@shapeshiftoss/hdwallet-core";
  import { caip2, ChainId, ChainReference } from "@shapeshiftoss/caip";
  
  export enum osmosisSigningModes{
      AMINO = 1,
      PROTOBUF = 2
  }
  
  export function osmosisGetAccountPaths(msg: OsmosisGetAccountPaths): Array<OsmosisAccountPath> {
    return [
      {
        addressNList: [0x80000000 + 44, 0x80000000 + slip44ByCoin("Atom"), 0x80000000 + msg.accountIdx, 0, 0],
      },
    ];
  }
  
  export async function osmosisSignTx(msg: OsmosisSignTx, mode: osmosisSigningModes): Promise<OsmosisSignedTx> {
      switch(mode){
          case osmosisSigningModes.AMINO:
              break;
          case osmosisSigningModes.PROTOBUF:
              break;
          default:
              throw new Error("Unsupported signing mode specified")
      }
    throw "Method not implemented.";
  }
  
  export async function osmosisGetAddress(msg: OsmosisGetAddress, chainId: ChainId = ChainReference.OsmosisMainnet): Promise<string | undefined> {
        await window?.keplr?.enable(chainId);
        const offlineSigner = window?.keplr?.getOfflineSigner(chainId);
        const address = (await offlineSigner?.getAccounts())?.[0].address;
        return address
  }