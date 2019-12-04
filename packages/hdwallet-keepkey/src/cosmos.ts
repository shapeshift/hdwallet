// import {
//   CosmosGetAddress,
//   CosmosSignTx,
//   CosmosGetAccountPath,
//   CosmosAccountPath,
//   CosmosSignedTx,
//   slip44ByCoin,
//   LONG_TIMEOUT,
//   Events,
// } 
import * as Core from '@shapeshiftoss/hdwallet-core'

import { KeepKeyTransport } from './transport'

import {
  CosmosGetAddress,
  CosmosAddress
} from '@keepkey/device-protocol/lib/messages-cosmos_pb'
import {
  MessageType
} from '@keepkey/device-protocol/lib/messages_pb'

export function cosmosGetAccountPaths (msg: Core.CosmosGetAccountPaths): Array<Core.CosmosAccountPath> {
  return [{
    addressNList: [ 0x80000000 + 44, 0x80000000 + Core.slip44ByCoin('Atom'), 0x80000000 + msg.accountIdx, 0, 0 ]
  }]
}

export async function cosmosSignTx (transport: KeepKeyTransport, msg: Core.CosmosSignTx): Promise<Core.CosmosSignedTx> {
  return transport.lockDuring(async () => {

    return {

    }
  })
}

export async function cosmosGetAddress (transport: KeepKeyTransport, msg: Core.CosmosGetAddress): Promise<string> {
  const getAddr = new CosmosGetAddress()
  getAddr.setAddressNList(msg.addressNList)
  getAddr.setShowDisplay(msg.showDisplay !== false)
  const response = await transport.call(MessageType.MESSAGETYPE_COSMOSGETADDRESS, getAddr, Core.LONG_TIMEOUT)

  if (response.message_type === Core.Events.FAILURE) throw response

  const cosmosAddress = response.proto as CosmosAddress
  return cosmosAddress.getAddress()
}
