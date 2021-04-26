import * as EosMessages from "@keepkey/device-protocol/lib/messages-eos_pb";
import * as Messages from "@keepkey/device-protocol/lib/messages_pb";
import * as core from "@shapeshiftoss/hdwallet-core";

import { Transport } from "./transport";

const createHash = require("create-hash");

function eosSigFormatter(r: Uint8Array, s: Uint8Array, v: number): string {
  const base58 = require("bs58");

  var recoverId = 0x1f;

  var signature: string = "SIG_K1_";

  console.log("formatter logs");
  var keyBuffer = Buffer.alloc(65);
  var rbuf = Buffer.from(r);
  var sbuf = Buffer.from(s);
  keyBuffer.writeUInt8(recoverId, 0);
  rbuf.copy(keyBuffer, 1);
  sbuf.copy(keyBuffer, 33);

  console.log(keyBuffer);
  const check = [keyBuffer];
  var keyType = "K1"; // we only sign using K1 curve
  check.push(Buffer.from(keyType));

  console.log(check);

  console.log("hash");
  console.log(createHash("ripemd160").update(Buffer.concat(check)).digest());
  const chksum = createHash("ripemd160").update(Buffer.concat(check)).digest().slice(0, 4);

  console.log(chksum);
  signature = signature.concat(base58.encode(Buffer.concat([keyBuffer, chksum])));

  console.log(signature);

  return signature;
}

function charToSymbol(c: string): number {
  if (c.charCodeAt(0) >= "a".charCodeAt(0) && c.charCodeAt(0) <= "z".charCodeAt(0)) {
    return c.charCodeAt(0) - "a".charCodeAt(0) + 6;
  }
  if (c.charCodeAt(0) >= "1".charCodeAt(0) && c.charCodeAt(0) <= "5".charCodeAt(0)) {
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

export function eosGetAccountPaths(msg: core.EosGetAccountPaths): Array<core.EosAccountPath> {
  return [
    {
      addressNList: [0x80000000 + 44, 0x80000000 + core.slip44ByCoin("Eos"), 0x80000000 + msg.accountIdx, 0, 0],
    },
  ];
}

export async function eosGetPublicKey(transport: Transport, msg: core.EosGetPublicKey): Promise<string> {
  const getPubkey = new EosMessages.EosGetPublicKey();
  getPubkey.setAddressNList(msg.addressNList);
  getPubkey.setShowDisplay(msg.showDisplay !== false);
  getPubkey.setKind(msg.kind);

  const response = await transport.call(Messages.MessageType.MESSAGETYPE_EOSGETPUBLICKEY, getPubkey, core.LONG_TIMEOUT);

  if (response.message_type === core.Events.FAILURE) throw response;

  const eosPubkey = response.proto as EosMessages.EosPublicKey;
  return core.mustBeDefined(eosPubkey.getWifPublicKey());
}

export async function eosSignTx(transport: Transport, msg: core.EosToSignTx): Promise<core.EosTxSigned> {
  return transport.lockDuring(async () => {
    let resp;

    // check some params
    if (msg.tx.actions.length > 1) {
      throw new Error(`Too many actions in Eos transaction: Keepkey only supports one!`);
    }

    const signTx = new EosMessages.EosSignTx();
    signTx.setAddressNList(msg.addressNList);
    signTx.setChainId(core.fromHexString(msg.chain_id));
    const txHeader = new EosMessages.EosTxHeader();

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

    console.log("tx header");
    console.log(txHeader);
    resp = await transport.call(Messages.MessageType.MESSAGETYPE_EOSSIGNTX, signTx, core.LONG_TIMEOUT, true);
    if (resp.message_type === core.Events.FAILURE) {
      throw resp;
    }

    if (resp.message_enum !== Messages.MessageType.MESSAGETYPE_EOSTXACTIONREQUEST) {
      throw new Error(`eos: unexpected response ${resp.message_type}`);
    }
    // parse the common block of the action
    let actCommon = new EosMessages.EosActionCommon();
    actCommon.setAccount(nameToNumber(msg.tx.actions[0].account).toString());
    actCommon.setName(nameToNumber(msg.tx.actions[0].name).toString());
    // interate through authorizations and add them
    for (let n = 0; n < msg.tx.actions[0].authorization.length; n++) {
      let actPerm = new EosMessages.EosPermissionLevel();
      actPerm.setActor(nameToNumber(msg.tx.actions[0].authorization[n].actor).toString());
      actPerm.setPermission(nameToNumber(msg.tx.actions[0].authorization[n].permission).toString());
      actCommon.addAuthorization(actPerm);
    }

    let actAck = new EosMessages.EosTxActionAck();
    actAck.setCommon(actCommon);
    // parse the various action types here.
    switch (msg.tx.actions[0].name) {
      case "transfer": {
        // build the transfer action
        let actType = new EosMessages.EosActionTransfer();
        actType.setSender(nameToNumber(msg.tx.actions[0].data.from).toString());
        actType.setReceiver(nameToNumber(msg.tx.actions[0].data.to).toString());

        let actAsset = new EosMessages.EosAsset();
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

    console.log("action data");
    console.log(actAck);

    resp = await transport.call(Messages.MessageType.MESSAGETYPE_EOSTXACTIONACK, actAck, core.LONG_TIMEOUT, true);
    if (resp.message_enum !== Messages.MessageType.MESSAGETYPE_EOSSIGNEDTX) {
      throw new Error(`eos: unexpected response ${resp.message_type}`);
    }

    const signedTx = resp.proto as EosMessages.EosSignedTx;

    // format signature for use in the eos system

    //    const EosFormatSig = eosSigFormatter(signedTx.getSignatureR() as Uint8Array, signedTx.getSignatureS() as Uint8Array, signedTx.getSignatureV())

    const signatureR = signedTx.getSignatureR_asU8();
    const signatureS = signedTx.getSignatureS_asU8();
    const signatureV = signedTx.getSignatureV();
    if (signatureV === undefined) throw new Error("missing signatureV");
    var sig = {
      signatureV,
      signatureR,
      signatureS,
      hash: signedTx.getHash(),
      eosFormSig: eosSigFormatter(signatureR, signatureS, signatureV),
    } as core.EosTxSigned;

    return sig;
  });
}
