import * as Core from '@shapeshiftoss/hdwallet-core'

import { KeepKeyTransport } from './transport'

import {
  EosGetPublicKey,
  EosPublicKey,
} from '@keepkey/device-protocol/lib/messages-eos_pb'
import {
  MessageType
} from '@keepkey/device-protocol/lib/messages_pb'

import { cloneDeep } from 'lodash'


export function cosmosGetAccountPaths (msg: Core.CosmosGetAccountPaths): Array<Core.CosmosAccountPath> {
  return [{
    addressNList: [ 0x80000000 + 44, 0x80000000 + Core.slip44ByCoin('Atom'), 0x80000000 + msg.accountIdx, 0, 0 ]
  }]
}

export function eosGetAccountPaths (msg: Core.EosGetAccountPaths): Array<Core.EosAccountPath> {
  return [{
    addressNList: [ 0x80000000 + 44, 0x80000000 + Core.slip44ByCoin('Eos'), 0x80000000 + msg.accountIdx, 0, 0 ]
  }]
}

export async function eosGetPublicKey (transport: KeepKeyTransport, msg: Core.EosGetPublicKey): Promise<string> {
  const getPubkey = new EosGetPublicKey()
  getPubkey.setAddressNList(msg.addressNList)
  getPubkey.setShowDisplay(msg.showDisplay !== false)
  getPubkey.setShowDisplay(msg.kind !== true)

  const response = await transport.call(MessageType.MESSAGETYPE_EOSGETPUBLICKEY, getPubkey, Core.LONG_TIMEOUT)

  if (response.message_type === Core.Events.FAILURE) throw response

  const eosPubkey = response.proto as EosPublicKey
  return eosPubkey.getWifPublicKey()
}
