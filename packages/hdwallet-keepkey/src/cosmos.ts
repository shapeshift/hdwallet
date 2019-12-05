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
  CosmosAddress,
  CosmosSignTx,
  CosmosMsgAck,
  CosmosSignedTx,
  CosmosMsgSend,
} from '@keepkey/device-protocol/lib/messages-cosmos_pb'
import {
  MessageType
} from '@keepkey/device-protocol/lib/messages_pb'

import { cloneDeep } from 'lodash'

export function cosmosGetAccountPaths (msg: Core.CosmosGetAccountPaths): Array<Core.CosmosAccountPath> {
  return [{
    addressNList: [ 0x80000000 + 44, 0x80000000 + Core.slip44ByCoin('Atom'), 0x80000000 + msg.accountIdx, 0, 0 ]
  }]
}

export async function cosmosSignTx (transport: KeepKeyTransport, msg: Core.CosmosSignTx): Promise<Core.CosmosSignedTx> {
  return transport.lockDuring(async () => {
    const signTx = new CosmosSignTx()
    signTx.setAddressNList(msg.addressNList)
    signTx.setAccountNumber(msg.account_number)
    signTx.setChainId(msg.chain_id)
    signTx.setFeeAmount(parseInt(msg.tx.value.fee.amount[0].amount))
    signTx.setGas(parseInt(msg.tx.value.fee.gas))
    signTx.setSequence(msg.sequence)
    if (msg.tx.value.memo !== undefined) signTx.setMemo(msg.tx.value.memo)
    signTx.setMsgCount(msg.tx.value.msg.length)

    let resp = await transport.call(MessageType.MESSAGETYPE_COSMOSSIGNTX, signTx, Core.LONG_TIMEOUT, /*omitLock=*/true)

    if (resp.message_type === Core.Events.FAILURE) throw resp

    for (let m of msg.tx.value.msg) {
      if (resp.message_enum !== MessageType.MESSAGETYPE_COSMOSMSGREQUEST) {
        throw new Error(`cosmos: unexpected response ${resp.message_type}`)
      }

      let ack

      if (m.type === 'cosmos-sdk/MsgSend') {
        if (m.value.amount.length !== 1) {
          throw new Error('cosmos: Multiple amounts per msg not supported')
        }

        const denom = m.value.amount[0].denom
        if (denom !== 'uatom') {
          throw new Error('cosmos: Unsupported denomination: ' + denom)
        }

        const send = new CosmosMsgSend()
        send.setFromAddress(m.value.from_address)
        send.setToAddress(m.value.to_address)
        send.setAmount(m.value.amount[0].amount)

        ack = new CosmosMsgAck()
        ack.setSend(send)
      } else {
        throw new Error(`cosmos: Message ${m.type} is not yet supported`)
      }

      resp = await transport.call(MessageType.MESSAGETYPE_COSMOSMSGACK, ack, Core.LONG_TIMEOUT, /*omitLock=*/true)

      if (resp.message_type === Core.Events.FAILURE) throw resp
    }

    if (resp.message_enum !== MessageType.MESSAGETYPE_COSMOSSIGNEDTX) {
      throw new Error(`cosmos: unexpected response ${resp.message_type}`)
    }

    const signedTx = resp.proto as CosmosSignedTx

    const signed = cloneDeep(msg.tx)

    signed.value.signatures = [{
      pub_key: {
        type: 'tendermine/PubKeySecp256k1',
        value: signedTx.getPublicKey_asB64()
      },
      signature: signedTx.getSignature_asB64()
    }]

    return signed
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
