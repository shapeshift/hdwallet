import * as Core from '@shapeshiftoss/hdwallet-core'

import { KeepKeyTransport } from './transport'

import {
  EosGetPublicKey,
  EosPublicKey,
  EosSignTx,
  EosTxHeader,
  EosTxActionRequest,
  EosTxActionAck,
  EosActionCommon,
  EosPermissionLevel,
  EosAsset,
  EosActionTransfer,
  EosSignedTx,
} from '@keepkey/device-protocol/lib/messages-eos_pb'
import {
  MessageType
} from '@keepkey/device-protocol/lib/messages_pb'

import { cloneDeep } from 'lodash'

export function eosGetAccountPaths (msg: Core.EosGetAccountPaths): Array<Core.EosAccountPath> {
  return [{
    addressNList: [ 0x80000000 + 44, 0x80000000 + Core.slip44ByCoin('Eos'), 0x80000000 + msg.accountIdx, 0, 0 ]
  }]
}


function assetToNumber(asset:string): [number, number] {
  let assetSplit= asset.split(' ')  // amount, symbol
  let dot_pos = assetSplit[0].indexOf('.')
  let fract_part = 0
  let int_part = 0
  let precision_digit = 0

  // parse symbol
  if (dot_pos != -1) {
      precision_digit = assetSplit[0].length - dot_pos - 1
  } else {
      precision_digit = 0
  }

  let sym = symbolFromString(precision_digit, assetSplit[1])
  //parse amount
  if (dot_pos != -1) {
//      int_part = int(amount_str[:dot_pos])
//      fract_part = int(amount_str[dot_pos+1:])
    int_part = parseInt(assetSplit[0].slice(0, dot_pos))
    fract_part = parseInt(assetSplit[0].slice(dot_pos+1))
      if (int_part < 0) {
          fract_part *= -1
      }
  } else {
      int_part = parseInt(assetSplit[0])
  }
//  console.log("parse asset")
//  console.log(assetSplit[0].slice(0, dot_pos))
//  console.log(assetSplit[0].slice(dot_pos+1))
//  console.log(precision_digit)
//  console.log(int_part)
//  console.log(fract_part)
  let amount = int_part
  amount *= Math.pow(10, sym & 0xff)
//  console.log(amount)
//  console.log(sym & 0xff)
  amount += fract_part
  return [amount, sym]
}

function symbolFromString(p:number, name:string): number {
  let result = 0
  for (var i=0; i<name.length; i++) {
      result |= name.charCodeAt(i) << (8 *(i+1))
  }
  result |= p
  return result
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

export async function eosSignTx (transport: KeepKeyTransport, msg: Core.EosToSignTx): Promise<Core.EosSignedTx> {
  return transport.lockDuring(async () => {

/*
    console.log("msg.tx")
    console.log(msg.tx)
    console.log("expiration")
    console.log(msg.tx.expiration)
*/
    const signTx = new EosSignTx()
    signTx.setAddressNList(msg.addressNList)
    signTx.setChainId(Core.fromHexString(msg.chain_id))
    const txHeader = new EosTxHeader()

    txHeader.setExpiration(Date.parse(msg.tx.expiration)/1000)
    txHeader.setRefBlockNum(msg.tx.ref_block_num)
    txHeader.setRefBlockPrefix(msg.tx.ref_block_prefix)
    txHeader.setMaxNetUsageWords(msg.tx.max_net_usage_words)
    txHeader.setMaxCpuUsageMs(msg.tx.max_cpu_usage_ms)
    txHeader.setDelaySec(msg.tx.delay_sec)
    signTx.setHeader(txHeader)
    signTx.setNumActions(msg.tx.actions.length)

    const resp = await transport.call(MessageType.MESSAGETYPE_EOSSIGNTX, signTx, Core.LONG_TIMEOUT, true)
    if (resp.message_type === Core.Events.FAILURE) {
//      console.log("throw resp")
//      console.log(resp)
      throw resp
    }

    let actCommon = new EosActionCommon();
    actCommon.setAccount(msg.tx.actions[0].account)
    actCommon.setName(msg.tx.actions[0].name)

    let actPerm = [new EosPermissionLevel()];
    actPerm[0].setActor(msg.tx.actions[0].authorization[0].actor)
    actPerm[0].setPermission(msg.tx.actions[0].authorization[0].permission)

    actCommon.setAuthorizationList(actPerm)
//    console.log("actcommon")
//    console.log(actCommon)

    let actTrans = new EosActionTransfer();
    actTrans.setSender(msg.tx.actions[0].data.from)
    actTrans.setReceiver(msg.tx.actions[0].data.to)

    let actAsset = new EosAsset();
    let assetParse = assetToNumber(msg.tx.actions[0].data.quantity)
//    console.log(assetParse)
//    console.log(assetParse[0])
//    console.log(assetParse[1])

    actAsset.setAmount(assetParse[0].toString())
    actAsset.setSymbol(assetParse[1].toString())
    actTrans.setQuantity(actAsset)

    actTrans.setMemo(msg.tx.actions[0].data.memo)
//    console.log("actTrans")
//    console.log(actTrans)

    let actAck = new EosTxActionAck();
    actAck.setCommon(actCommon);
    actAck.setTransfer(actTrans);
//    console.log("actAck")
//    console.log(actAck)

/*
    // For each action we need to parse it based on action:name and send it to the wallet.
    for (let m = 0; m < msg.tx.actions.length; m++) {
      if (resp.message_enum === MessageType.MESSAGETYPE_EOSTXACTIONREQUEST) {

        let actCommon = msg.tx.actions[m] as Core.EosTxCommon
        console.log("actcommon")
        console.log(actCommon)


        let actCommon = new EosActionCommon();
        actCommon.setAccount(msg
        let actAck = new EosTxActionAck();
        actAck.setCommon(actCommon);



        switch (msg.tx.actions[m].name) {
          case "transfer":
//            actAck.setTransfer((msg.tx.actions[m].data) as Core.Eos.EosActionTransfer);
            break;

          default:
            break;

        } 
        console.log("actack")
        console.log(actAck)
        resp  = await transport.call(MessageType.MESSAGETYPE_EOSTXACTIONACK, actAck, Core.LONG_TIMEOUT, true)

      } else {
          throw resp;
      }
    }

    if (resp.message_enum !== MessageType.MESSAGETYPE_EOSSIGNEDTX) {
      throw new Error(`cosmos: unexpected response ${resp.message_type}`)
    }
*/
//    const signedTx = resp.proto as Core.EosSignedTx
    const signedTx = "junk" as Core.EosSignedTx

    return signedTx
  })
}
