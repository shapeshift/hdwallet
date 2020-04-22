import * as Core from "@shapeshiftoss/hdwallet-core";

import { KeepKeyTransport } from "./transport";

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
} from "@keepkey/device-protocol/lib/messages-eos_pb";
import { MessageType } from "@keepkey/device-protocol/lib/messages_pb";

import { cloneDeep } from "lodash";

var Long = require("long");

export function eosGetAccountPaths(
  msg: Core.EosGetAccountPaths
): Array<Core.EosAccountPath> {
  return [
    {
      addressNList: [
        0x80000000 + 44,
        0x80000000 + Core.slip44ByCoin("Eos"),
        0x80000000 + msg.accountIdx,
        0,
        0,
      ],
    },
  ];
}

function charToSymbol(c: string): number {
  if (
    c.charCodeAt(0) >= "a".charCodeAt(0) &&
    c.charCodeAt(0) <= "z".charCodeAt(0)
  ) {
    return c.charCodeAt(0) - "a".charCodeAt(0) + 6;
  }
  if (
    c.charCodeAt(0) >= "1".charCodeAt(0) &&
    c.charCodeAt(0) <= "5".charCodeAt(0)
  ) {
    return c.charCodeAt(0) - "1".charCodeAt(0) + 1;
  }
  return 0;
}

function nameToNumber(name: string): string {
  var Long = require("long");
  let value = new Long(0, 0, true);
  let c = new Long(0, 0, true);

  for (let i = 0; i < 13; i++) {
    if (i < name.length && i < 13) {
      c = Long.fromNumber(charToSymbol(name[i]), true);
    }

    if (i < 12) {
      c = c.and(Long.fromString("1f", true, 16));
      c = c.shl(64 - 5 * (i + 1));
    } else {
      // last iteration
      c = c.and(Long.fromString("0f", true, 16));
    }
    value = value.or(c);
  }
  return value.toString();
}

function assetToNumber(asset: string): [number, number] {
  let assetSplit = asset.split(" "); // amount, symbol
  let dot_pos = assetSplit[0].indexOf(".");
  let fract_part = 0;
  let int_part = 0;
  let precision_digit = 0;

  // parse symbol
  if (dot_pos != -1) {
    precision_digit = assetSplit[0].length - dot_pos - 1;
  } else {
    precision_digit = 0;
  }

  let sym = symbolFromString(precision_digit, assetSplit[1]);
  //parse amount
  if (dot_pos != -1) {
    int_part = parseInt(assetSplit[0].slice(0, dot_pos));
    fract_part = parseInt(assetSplit[0].slice(dot_pos + 1));
    if (int_part < 0) {
      fract_part *= -1;
    }
  } else {
    int_part = parseInt(assetSplit[0]);
  }
  let amount = int_part;
  amount *= Math.pow(10, sym & 0xff);
  amount += fract_part;
  return [amount, sym];
}

function symbolFromString(p: number, name: string): number {
  let result = 0;
  for (var i = 0; i < name.length; i++) {
    result |= name.charCodeAt(i) << (8 * (i + 1));
  }
  result |= p;
  return result;
}

export async function eosGetPublicKey(
  transport: KeepKeyTransport,
  msg: Core.EosGetPublicKey
): Promise<string> {
  const getPubkey = new EosGetPublicKey();
  getPubkey.setAddressNList(msg.addressNList);
  getPubkey.setShowDisplay(msg.showDisplay !== false);
  getPubkey.setKind(msg.kind);

  const response = await transport.call(
    MessageType.MESSAGETYPE_EOSGETPUBLICKEY,
    getPubkey,
    Core.LONG_TIMEOUT
  );

  if (response.message_type === Core.Events.FAILURE) throw response;

  const eosPubkey = response.proto as EosPublicKey;
  return eosPubkey.getWifPublicKey();
}

export async function eosSignTx(
  transport: KeepKeyTransport,
  msg: Core.EosToSignTx
): Promise<Core.EosSignedTx> {
  return transport.lockDuring(async () => {
    let resp;

    // check some params
    if (msg.tx.actions.length > 1) {
      throw new Error(
        `Too many actions in Eos transaction: Keepkey only supports one!`
      );
    }

    const signTx = new EosSignTx();
    signTx.setAddressNList(msg.addressNList);
    signTx.setChainId(Core.fromHexString(msg.chain_id));
    const txHeader = new EosTxHeader();

    txHeader.setExpiration(
      (Date.parse(msg.tx.expiration) -
        Date.parse("01 Jan 1970 00:00:00Z") -
        new Date().getTimezoneOffset() * 60 * 1000) /
        1000
    );
    txHeader.setRefBlockNum(msg.tx.ref_block_num);
    txHeader.setRefBlockPrefix(msg.tx.ref_block_prefix);
    txHeader.setMaxNetUsageWords(msg.tx.max_net_usage_words);
    txHeader.setMaxCpuUsageMs(msg.tx.max_cpu_usage_ms);
    txHeader.setDelaySec(msg.tx.delay_sec);
    signTx.setHeader(txHeader);
    signTx.setNumActions(msg.tx.actions.length);

    resp = await transport.call(
      MessageType.MESSAGETYPE_EOSSIGNTX,
      signTx,
      Core.LONG_TIMEOUT,
      true
    );
    if (resp.message_type === Core.Events.FAILURE) {
      throw resp;
    }

    if (resp.message_enum !== MessageType.MESSAGETYPE_EOSTXACTIONREQUEST) {
      throw new Error(`eos: unexpected response ${resp.message_type}`);
    }
    // parse the common block of the action
    let actCommon = new EosActionCommon();
    actCommon.setAccount(nameToNumber(msg.tx.actions[0].account).toString());
    actCommon.setName(nameToNumber(msg.tx.actions[0].name).toString());
    // interate through authorizations and add them
    for (let n = 0; n < msg.tx.actions[0].authorization.length; n++) {
      let actPerm = new EosPermissionLevel();
      actPerm.setActor(
        nameToNumber(msg.tx.actions[0].authorization[n].actor).toString()
      );
      actPerm.setPermission(
        nameToNumber(msg.tx.actions[0].authorization[n].permission).toString()
      );
      actCommon.addAuthorization(actPerm);
    }

    let actAck = new EosTxActionAck();
    actAck.setCommon(actCommon);
    // parse the various action types here.
    switch (msg.tx.actions[0].name) {
      case "transfer": {
        // build the transfer action
        let actType = new EosActionTransfer();
        actType.setSender(nameToNumber(msg.tx.actions[0].data.from).toString());
        actType.setReceiver(nameToNumber(msg.tx.actions[0].data.to).toString());

        let actAsset = new EosAsset();
        let assetParse = assetToNumber(msg.tx.actions[0].data.quantity);
        actAsset.setAmount(assetParse[0].toString());
        actAsset.setSymbol(assetParse[1].toString());

        actType.setQuantity(actAsset);
        actType.setMemo(msg.tx.actions[0].data.memo);
        actAck.setTransfer(actType);
        break;
      }
      default: {
      }
    }

    resp = await transport.call(
      MessageType.MESSAGETYPE_EOSTXACTIONACK,
      actAck,
      Core.LONG_TIMEOUT,
      true
    );
    console.log(" action done");
    if (resp.message_enum !== MessageType.MESSAGETYPE_EOSSIGNEDTX) {
      throw new Error(`eos: unexpected response ${resp.message_type}`);
    }

    const signedTx = resp.proto as EosSignedTx;
    var sig = {
      signatureV: signedTx.getSignatureV(),
      signatureR: signedTx.getSignatureR(),
      signatureS: signedTx.getSignatureS(),
      hash: signedTx.getHash(),
    } as Core.EosSignedTx;

    return sig;
  });
}
