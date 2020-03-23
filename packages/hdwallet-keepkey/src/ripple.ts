import * as Core from "@shapeshiftoss/hdwallet-core";

import { KeepKeyTransport } from "./transport";

import {
  RippleAddress,
  RippleGetAddress,
  RipplePayment,
  RippleSignTx,
  RippleSignedTx
} from "@keepkey/device-protocol/lib/messages-ripple_pb";
import { MessageType } from "@keepkey/device-protocol/lib/messages_pb";

import { cloneDeep } from "lodash";

export async function rippleSignTx(
  transport: KeepKeyTransport,
  msg: Core.RippleSignTx
): Promise<Core.RippleSignedTx> {
  return transport.lockDuring(async () => {
    const signTx = new RippleSignTx();

    let resp = await transport.call(MessageType.MESSAGETYPE_COSMOS);

    re;
    const signedTx = resp.prot;
    signed = cloneDeep(msg.tx);
    return msg;
  });
}
