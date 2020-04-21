import * as Core from '@shapeshiftoss/hdwallet-core'

import { KeepKeyTransport } from './transport'

import {
  EosGetPublicKey,
  EosPublicKey,
  EosPublicKeyKindMap,
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

var Long = require("long")

export function eosGetAccountPaths (msg: Core.EosGetAccountPaths): Array<Core.EosAccountPath> {
  return [{
    addressNList: [ 0x80000000 + 44, 0x80000000 + Core.slip44ByCoin('Eos'), 0x80000000 + msg.accountIdx, 0, 0 ]
  }]
}


function charToSymbol(c:string) : number {
  if (c.charCodeAt(0) >= "a".charCodeAt(0) && c.charCodeAt(0) <= "z".charCodeAt(0)) {
    return ((c.charCodeAt(0) - "a".charCodeAt(0)) + 6)
  }
  if (c.charCodeAt(0) >= "1".charCodeAt(0) && c.charCodeAt(0) <= "5".charCodeAt(0)) {
    return ((c.charCodeAt(0) - "1".charCodeAt(0)) + 1)
  }
  return 0
}

function nameToNumber(name:string) : string {

  var Long = require("long")
  let value = new Long(0, 0, true)
  let c = new Long(0, 0, true)

  for (let i=0; i<13; i++) {
    if (i < name.length && i < 13) {
        c = Long.fromNumber(charToSymbol(name[i]), true)
    }

    if (i < 12) {
        c = c.and(Long.fromString("1f", true, 16))
        c = c.shl(64 - 5 * (i + 1))

    } else { // last iteration
        c = c.and(Long.fromString("0f", true, 16))
    }    
      value = value.or(c)
  }
  return value.toString()
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
//  FIX THIS !!
  getPubkey.setKind(msg.kind)

  const response = await transport.call(MessageType.MESSAGETYPE_EOSGETPUBLICKEY, getPubkey, Core.LONG_TIMEOUT)

  if (response.message_type === Core.Events.FAILURE) throw response

  const eosPubkey = response.proto as EosPublicKey
  return eosPubkey.getWifPublicKey()
}

export async function eosSignTx (transport: KeepKeyTransport, msg: Core.EosToSignTx): Promise<Core.EosSignedTx> {
  return transport.lockDuring(async () => {

    let resp

    const signTx = new EosSignTx()
    signTx.setAddressNList(msg.addressNList)
    signTx.setChainId(Core.fromHexString(msg.chain_id))
    const txHeader = new EosTxHeader()


//    txHeader.setExpiration(Date.parse(msg.tx.expiration)/1000 Date.parse("01 Jan 1970 00:00:00 GMT")/1000))
    txHeader.setExpiration((Date.parse(msg.tx.expiration)-Date.parse("01 Jan 1970 00:00:00Z") - new Date().getTimezoneOffset()*60*1000) / 1000)
//    console.log("expiration")
//    console.log((Date.parse(msg.tx.expiration)-Date.parse("01 Jan 1970 00:00:00Z") - new Date().getTimezoneOffset()*60*1000) / 1000)
    txHeader.setRefBlockNum(msg.tx.ref_block_num)
    txHeader.setRefBlockPrefix(msg.tx.ref_block_prefix)
    txHeader.setMaxNetUsageWords(msg.tx.max_net_usage_words)
    txHeader.setMaxCpuUsageMs(msg.tx.max_cpu_usage_ms)
    txHeader.setDelaySec(msg.tx.delay_sec)
    signTx.setHeader(txHeader)
    signTx.setNumActions(msg.tx.actions.length)

//    console.log("signtx")
//    console.log(signTx)
    resp = await transport.call(MessageType.MESSAGETYPE_EOSSIGNTX, signTx, Core.LONG_TIMEOUT, true)
//    console.log("signtx resp")
//    console.log(resp)
    if (resp.message_type === Core.Events.FAILURE) {
//      console.log("throw resp")
//      console.log(resp)
      throw resp
    }
    // For each action we need to parse it based on action:name and send it to the wallet.
    /* 
       Keepkey will only accept 1 action per tx. The client will look for more and send them,
       but kk will return an error if more than 1.
    */
    for (let m = 0; m < msg.tx.actions.length; m++) {
      let actAsset, assetParse, actCommon, actAck, actType, actPerm
//      console.log("m")
//      console.log(m)
      if (resp.message_enum !== MessageType.MESSAGETYPE_EOSTXACTIONREQUEST) {
        console.log("signtx error resp")
        console.log(resp)
        throw new Error(`eos: unexpected response ${resp.message_type}`)
      }

      // parse the common block of the action
      // build the common section
      actCommon = new EosActionCommon();
//      console.log("name to number")
//      console.log(nameToNumber(msg.tx.actions[m].account))

      actCommon.setAccount(nameToNumber(msg.tx.actions[m].account).toString())
      actCommon.setName(nameToNumber(msg.tx.actions[m].name).toString())
      // interate through authorizations and add them
      for (let n = 0; n<msg.tx.actions[m].authorization.length; n++) {
        actPerm = new EosPermissionLevel()
        // console.log("actor")
        // console.log(msg.tx.actions[m].authorization[0].actor)
        actPerm.setActor(nameToNumber(msg.tx.actions[m].authorization[n].actor).toString())
        actPerm.setPermission(nameToNumber(msg.tx.actions[m].authorization[n].permission).toString())
//        actPerm.setActor(<any>(msg.tx.actions[m].authorization[0]).actor)
//        actPerm.setPermission(msg.tx.actions[m].authorization[0].permission)
        actCommon.addAuthorization(actPerm)           
//        actCommon.addAuthorization(new (msg.tx.actions[m].authorization[0] as EosPermissionLevel))           
      }

      actAck = new EosTxActionAck();
      actAck.setCommon(actCommon);    

      console.log("enter switch")
      // parse the various action types here.
      switch (msg.tx.actions[m].name) {
        case "transfer": {
          // build the transfer action
          console.log("set up transfer")
          actType = new EosActionTransfer();
          actType.setSender(nameToNumber(msg.tx.actions[m].data.from).toString())
          actType.setReceiver(nameToNumber(msg.tx.actions[m].data.to).toString())
  
          actAsset = new EosAsset();
          assetParse = assetToNumber(msg.tx.actions[m].data.quantity)
          actAsset.setAmount(assetParse[0].toString())
          actAsset.setSymbol(assetParse[1].toString())
  
          actType.setQuantity(actAsset)
          actType.setMemo(msg.tx.actions[m].data.memo)

          actAck.setTransfer(actType)
//          break;
        }
        default: {
        }
      } 

      console.log(" send action") 
      resp = await transport.call(MessageType.MESSAGETYPE_EOSTXACTIONACK, actAck, Core.LONG_TIMEOUT, true)
      console.log(" action done")
    }

    if (resp.message_enum !== MessageType.MESSAGETYPE_EOSSIGNEDTX) {
      console.log("error txactionack")
      console.log(resp)
      throw new Error(`eos: unexpected response ${resp.message_type}`)
    }

//    const signedTx = resp.proto as Core.EosSignedTx
//    const signedTx = resp as Core.EosSignedTx
    const signedTx = resp.proto as EosSignedTx
    var sig = {
      signatureV : signedTx.getSignatureV(),
      signatureR : signedTx.getSignatureR(),
      signatureS : signedTx.getSignatureS(),
      hash : signedTx.getHash() 
    } as Core.EosSignedTx

//    console.log(" signed tx")
//    console.log(signedTx)
    return sig
  })
}
