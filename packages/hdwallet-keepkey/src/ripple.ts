import * as Core from "@shapeshiftoss/hdwallet-core";

import { KeepKeyTransport } from "./transport";

import {
  RippleAddress,
  RippleGetAddress,
  RipplePayment,
  RippleSignTx,
  RippleSignedTx,
} from "@keepkey/device-protocol/lib/messages-ripple_pb";
import { MessageType } from "@keepkey/device-protocol/lib/messages_pb";

import { cloneDeep } from "lodash";

export function rippleGetAccountPaths(msg: Core.RippleGetAccountPaths): Array<Core.RippleAccountPath> {
  return [
    {
      addressNList: [0x80000000 + 44, 0x80000000 + Core.slip44ByCoin("Ripple"), 0x80000000 + msg.accountIdx, 0, 0],
    },
  ];
}

export async function rippleSignTx(transport: KeepKeyTransport, msg: Core.RippleSignTx): Promise<Core.RippleSignedTx> {
  return transport.lockDuring(async () => {
    const signTx = new RippleSignTx();
    signTx.setAddressNList(msg.addressNList);
    signTx.setFee(parseInt(msg.tx.value.fee.amount[0].amount));
    signTx.setSequence(parseInt(msg.sequence));
    signTx.setLastLedgerSequence(parseInt(msg.lastLedgerSequence));

    const payment = new RipplePayment();
    payment.setAmount(parseInt(msg.payment.amount));
    payment.setDestination(msg.payment.destination);
    payment.setDestinationTag(parseInt(msg.payment.destinationTag));
    signTx.setPayment(payment);

    let resp = await transport.call(
      MessageType.MESSAGETYPE_RIPPLESIGNTX,
      signTx,
      Core.LONG_TIMEOUT,
      /*omitLock=*/ true
    );

    if (resp.message_type === Core.Events.FAILURE) throw resp;

    for (let m of msg.tx.value.msg) {
      let ack;

      if (m.type === "ripple-sdk/MsgSend") {
        if (m.value.amount.length !== 1) {
          throw new Error("ripple: Multiple amounts per msg not supported");
        }

        const denom = m.value.amount[0].denom;
        if (denom !== "drop") {
          throw new Error("ripple: Unsupported denomination: " + denom);
        }
      } else {
        throw new Error(`ripple: Message ${m.type} is not yet supported`);
      }

      if (resp.message_type === Core.Events.FAILURE) throw resp;
    }

    if (resp.message_enum !== MessageType.MESSAGETYPE_RIPPLESIGNEDTX) {
      throw new Error(`ripple: unexpected response ${resp.message_type}`);
    }

    const signedTx = resp.proto as RippleSignedTx;

    const signed = cloneDeep(msg.tx);

    signed.value.signatures = [
      {
        serializedTx: signedTx.getSerializedTx_asB64(),
        signature: signedTx.getSignature_asB64(),
      },
    ];
    return signed;
  });
}

export async function rippleGetAddress(transport: KeepKeyTransport, msg: Core.RippleGetAddress): Promise<string> {
  const getAddr = new RippleGetAddress();
  getAddr.setAddressNList(msg.addressNList);
  getAddr.setShowDisplay(msg.showDisplay !== false);
  const response = await transport.call(MessageType.MESSAGETYPE_RIPPLEGETADDRESS, getAddr, Core.LONG_TIMEOUT);

  if (response.message_type === Core.Events.FAILURE) throw response;

  const rippleAddress = response.proto as RippleAddress;
  return rippleAddress.getAddress();
}
