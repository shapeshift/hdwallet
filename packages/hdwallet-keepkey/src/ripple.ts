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

export function rippleGetAccountPaths(
  msg: Core.RippleGetAccountPaths
): Array<Core.RippleAccountPath> {
  return [
    {
      addressNList: [
        0x80000000 + 44,
        0x80000000 + Core.slip44ByCoin("Ripple"),
        0x80000000 + msg.accountIdx,
        0,
        0
      ]
    }
  ];
}

// export async function rippleSignTx(
//   transport: KeepKeyTransport,
//   msg: Core.RippleSignTx
// ): Promise<Core.RippleSignedTx> {
//   return transport.lockDuring(async () => {
//     const signTx = new RippleSignTx();
//     signTx.setAddressNList(msg.addressNList);
//     signTx.setFlags(msg.flags);
//     signTx.setSequence(msg.sequence);
//     signTx.setLastLedgerSequence(msg.lastLedgerSequence);
//     signTx.setPayment(msg.payment);
//     signTx.setFee(msg.fee);

//     let resp = await transport.call(
//       MessageType.MESSAGETYPE_RIPPLESIGNTX,
//       signTx,
//       Core.LONG_TIMEOUT,
//       /*omitLock=*/ true
//     );

//     if (resp.message_type === Core.Events.FAILURE) {
//       throw resp;
//     }

//     // const signedTx = resp.prot;
//     // const signed = cloneDeep(msg.tx);
//     return msg;
//   });
// }

export async function rippleGetAddress(
  transport: KeepKeyTransport,
  msg: Core.RippleGetAddress
): Promise<string> {
  const getAddr = new RippleGetAddress();
  getAddr.setAddressNList(msg.addressNList);
  getAddr.setShowDisplay(msg.showDisplay !== false);
  const response = await transport.call(
    MessageType.MESSAGETYPE_RIPPLEGETADDRESS,
    getAddr,
    Core.LONG_TIMEOUT
  );

  if (response.message_type === Core.Events.FAILURE) throw response;

  const rippleAddress = response.proto as RippleAddress;
  return rippleAddress.getAddress();
}
