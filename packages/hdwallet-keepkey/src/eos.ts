import * as Messages from "@keepkey/device-protocol/lib/messages_pb";
import * as EosMessages from "@keepkey/device-protocol/lib/messages-eos_pb";
import * as core from "@shapeshiftoss/hdwallet-core";
import * as bs58 from "bs58";
import createHash from "create-hash";
import Long from "long";

import { Transport } from "./transport";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function eosSigFormatter(r: Uint8Array, s: Uint8Array, v: number): string {
  const recoverId = 0x1f;

  let signature = "SIG_K1_";

  console.debug("formatter logs");
  const keyBuffer = Buffer.alloc(65);
  const rbuf = Buffer.from(r);
  const sbuf = Buffer.from(s);
  keyBuffer.writeUInt8(recoverId, 0);
  rbuf.copy(keyBuffer, 1);
  sbuf.copy(keyBuffer, 33);

  console.debug(keyBuffer);
  const check = [keyBuffer];
  const keyType = "K1"; // we only sign using K1 curve
  check.push(Buffer.from(keyType));

  console.debug(check);

  console.debug("hash");
  console.debug(createHash("ripemd160").update(core.compatibleBufferConcat(check)).digest());
  const chksum = createHash("ripemd160").update(core.compatibleBufferConcat(check)).digest().slice(0, 4);

  console.debug(chksum);
  signature = signature.concat(bs58.encode(core.compatibleBufferConcat([keyBuffer, chksum])));

  console.debug(signature);

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

function symbolFromString(p: number, name: string): number {
  let result = 0;
  for (let i = 0; i < name.length; i++) {
    result |= name.charCodeAt(i) << (8 * (i + 1));
  }
  result |= p;
  return result;
}

function assetToNumber(asset: string): [number, number] {
  const assetSplit = asset.split(" "); // amount, symbol
  const dot_pos = assetSplit[0].indexOf(".");
  let fract_part = 0;
  let int_part = 0;
  let precision_digit = 0;

  // parse symbol
  if (dot_pos != -1) {
    precision_digit = assetSplit[0].length - dot_pos - 1;
  } else {
    precision_digit = 0;
  }

  const sym = symbolFromString(precision_digit, assetSplit[1]);
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

  const response = await transport.call(Messages.MessageType.MESSAGETYPE_EOSGETPUBLICKEY, getPubkey, {
    msgTimeout: core.LONG_TIMEOUT,
  });

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

    console.debug("tx header");
    console.debug(txHeader);
    resp = await transport.call(Messages.MessageType.MESSAGETYPE_EOSSIGNTX, signTx, {
      msgTimeout: core.LONG_TIMEOUT,
      omitLock: true,
    });

    if (resp.message_enum !== Messages.MessageType.MESSAGETYPE_EOSTXACTIONREQUEST) {
      throw new Error(`eos: unexpected response ${resp.message_type}`);
    }
    // parse the common block of the action
    const actCommon = new EosMessages.EosActionCommon();
    actCommon.setAccount(nameToNumber(msg.tx.actions[0].account).toString());
    actCommon.setName(nameToNumber(msg.tx.actions[0].name).toString());
    // interate through authorizations and add them
    for (let n = 0; n < msg.tx.actions[0].authorization.length; n++) {
      const actPerm = new EosMessages.EosPermissionLevel();
      actPerm.setActor(nameToNumber(msg.tx.actions[0].authorization[n].actor).toString());
      actPerm.setPermission(nameToNumber(msg.tx.actions[0].authorization[n].permission).toString());
      actCommon.addAuthorization(actPerm);
    }

    const actAck = new EosMessages.EosTxActionAck();
    actAck.setCommon(actCommon);
    // parse the various action types here.
    switch (msg.tx.actions[0].name) {
      case "transfer": {
        // build the transfer action
        const actType = new EosMessages.EosActionTransfer();
        actType.setSender(nameToNumber(msg.tx.actions[0].data.from).toString());
        actType.setReceiver(nameToNumber(msg.tx.actions[0].data.to).toString());

        const actAsset = new EosMessages.EosAsset();
        const assetParse = assetToNumber(msg.tx.actions[0].data.quantity);
        actAsset.setAmount(assetParse[0].toString());
        actAsset.setSymbol(assetParse[1].toString());

        actType.setQuantity(actAsset);
        actType.setMemo(msg.tx.actions[0].data.memo);
        actAck.setTransfer(actType);
        break;
      }
    }

    console.debug("action data");
    console.debug(actAck);

    resp = await transport.call(Messages.MessageType.MESSAGETYPE_EOSTXACTIONACK, actAck, {
      msgTimeout: core.LONG_TIMEOUT,
      omitLock: true,
    });
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
    const sig = {
      signatureV,
      signatureR,
      signatureS,
      hash: signedTx.getHash(),
      eosFormSig: eosSigFormatter(signatureR, signatureS, signatureV),
    } as core.EosTxSigned;

    return sig;
  });
}
