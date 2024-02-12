import * as Messages from "@keepkey/device-protocol/lib/messages_pb";
import * as RippleMessages from "@keepkey/device-protocol/lib/messages-ripple_pb";
import * as core from "@shapeshiftoss/hdwallet-core";
import _ from "lodash";

import { Transport } from "./transport";

export function rippleGetAccountPaths(msg: core.RippleGetAccountPaths): Array<core.RippleAccountPath> {
  return [
    {
      addressNList: [0x80000000 + 44, 0x80000000 + core.slip44ByCoin("Ripple"), 0x80000000 + msg.accountIdx, 0, 0],
    },
  ];
}

export async function rippleSignTx(transport: Transport, msg: core.RippleSignTx): Promise<core.RippleSignedTx> {
  return transport.lockDuring(async () => {
    const signTx = new RippleMessages.RippleSignTx();
    signTx.setAddressNList(msg.addressNList);
    signTx.setFee(parseInt(msg.tx.value.fee.amount[0].amount));
    signTx.setSequence(parseInt(msg.sequence));
    signTx.setLastLedgerSequence(parseInt(msg.lastLedgerSequence));

    const payment = new RippleMessages.RipplePayment();
    payment.setAmount(parseInt(msg.payment.amount));
    payment.setDestination(msg.payment.destination);
    if (msg.payment.destinationTag !== undefined) payment.setDestinationTag(parseInt(msg.payment.destinationTag));
    signTx.setPayment(payment);

    const resp = await transport.call(Messages.MessageType.MESSAGETYPE_RIPPLESIGNTX, signTx, {
      msgTimeout: core.LONG_TIMEOUT,
      omitLock: true,
    });

    for (const m of msg.tx.value.msg) {
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
    }

    if (resp.message_enum !== Messages.MessageType.MESSAGETYPE_RIPPLESIGNEDTX) {
      throw new Error(`ripple: unexpected response ${resp.message_type}`);
    }

    const signedTx = resp.proto as RippleMessages.RippleSignedTx;

    const signed = _.cloneDeep(msg.tx);

    signed.value.signatures = [
      {
        serializedTx: signedTx.getSerializedTx_asB64(),
        signature: signedTx.getSignature_asB64(),
      },
    ];
    return signed;
  });
}

export async function rippleGetAddress(transport: Transport, msg: core.RippleGetAddress): Promise<string> {
  const getAddr = new RippleMessages.RippleGetAddress();
  getAddr.setAddressNList(msg.addressNList);
  getAddr.setShowDisplay(msg.showDisplay !== false);
  const response = await transport.call(Messages.MessageType.MESSAGETYPE_RIPPLEGETADDRESS, getAddr, {
    msgTimeout: core.LONG_TIMEOUT,
  });

  const rippleAddress = response.proto as RippleMessages.RippleAddress;
  return core.mustBeDefined(rippleAddress.getAddress());
}
